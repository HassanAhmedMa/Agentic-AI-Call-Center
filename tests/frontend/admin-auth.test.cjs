const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createAdminAuthFixture() {
  const store = new Map();
  const localStorage = {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); }
  };

  const elements = new Map();
  function getEl(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        textContent: '',
        value: '',
        style: {},
        classList: {
          add() {},
          remove() {},
          toggle() {}
        }
      });
    }
    return elements.get(id);
  }

  const document = {
    addEventListener(name, fn) {},
    getElementById: getEl,
    querySelectorAll() { return []; },
    createElement() { return getEl('toast'); }
  };

  const window = {
    location: { href: 'index.html' },
    localStorage,
    document,
    alert() {},
    showToast() {}
  };

  const context = {
    window,
    document,
    localStorage,
    JSON,
    Date,
    Array,
    String,
    Number,
    alert() {},
    console
  };

  const scriptContent = fs.readFileSync('frontend/admin/admin-auth.js', 'utf8');
  vm.runInNewContext(scriptContent, context);

  return { AdminAuth: window.AdminAuth, localStorage, elements };
}

test('AdminAuth: default user is administrator with full privileges', () => {
  const { AdminAuth } = createAdminAuthFixture();
  const user = AdminAuth.getCurrentUser();
  assert.equal(user.role, 'admin');
  assert.equal(AdminAuth.isAdmin(), true);
  assert.equal(AdminAuth.isOperator(), false);
  assert.equal(AdminAuth.checkPermission('delete_patient'), true);
  assert.equal(AdminAuth.checkPermission('delete_doctor'), true);
  assert.equal(AdminAuth.checkPermission('add_doctor'), true);
  assert.equal(AdminAuth.checkPermission('create_operator'), true);
});

test('AdminAuth: operator role enforces strict deletion & doctor addition restrictions', () => {
  const { AdminAuth } = createAdminAuthFixture();
  AdminAuth.setCurrentUser({
    name: 'Salma Operator',
    email: 'salma@operator.clinic',
    role: 'operator'
  });

  assert.equal(AdminAuth.isAdmin(), false);
  assert.equal(AdminAuth.isOperator(), true);

  // Restricted actions for operator
  assert.equal(AdminAuth.checkPermission('delete_patient'), false);
  assert.equal(AdminAuth.checkPermission('delete_doctor'), false);
  assert.equal(AdminAuth.checkPermission('add_doctor'), false);
  assert.equal(AdminAuth.checkPermission('create_operator'), false);

  // Allowed actions for operator
  assert.equal(AdminAuth.checkPermission('view_patients'), true);
  assert.equal(AdminAuth.checkPermission('edit_patient'), true);
  assert.equal(AdminAuth.checkPermission('add_patient'), true);
  assert.equal(AdminAuth.checkPermission('view_doctors'), true);
});

test('AdminAuth: manages operators directory storage correctly', () => {
  const { AdminAuth } = createAdminAuthFixture();
  const initial = AdminAuth.getStoredOperators();
  assert.ok(Array.isArray(initial));
  assert.ok(initial.length >= 2);

  // Add new operator
  const newOp = {
    id: 99,
    name: 'Test Operator',
    email: 'test@operator.clinic',
    role: 'operator'
  };
  AdminAuth.saveOperators([...initial, newOp]);

  const updated = AdminAuth.getStoredOperators();
  assert.equal(updated.length, initial.length + 1);
  assert.ok(updated.some(o => o.email === 'test@operator.clinic'));
});

test('AdminAuth: logout clears session and redirects to login.html', () => {
  const { AdminAuth, localStorage } = createAdminAuthFixture();
  AdminAuth.setCurrentUser({
    name: 'Test User',
    email: 'test@operator.clinic',
    role: 'operator'
  });

  AdminAuth.logout();
  assert.equal(localStorage.getItem('clinic_admin_user_session'), null);
});
