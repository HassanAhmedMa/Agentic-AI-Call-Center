-- Synthetic catalog only; no patient data or credentials.

BEGIN;

SET LOCAL search_path TO "clinic";

SELECT pg_advisory_xact_lock(41001001);

INSERT INTO specialties (id, name_en, name_ar, synonyms, search_terms) VALUES (1, 'Cardiology', 'أمراض القلب', ARRAY['قلب', 'heart', 'cardio'], ARRAY['cardio', 'cardiology', 'heart', 'امراض القلب', 'قلب']) ON CONFLICT (id) DO NOTHING;

INSERT INTO specialties (id, name_en, name_ar, synonyms, search_terms) VALUES (2, 'Dermatology', 'الأمراض الجلدية', ARRAY['جلدية', 'جلد', 'skin'], ARRAY['dermatology', 'skin', 'الامراض الجلديه', 'جلد', 'جلديه']) ON CONFLICT (id) DO NOTHING;

INSERT INTO specialties (id, name_en, name_ar, synonyms, search_terms) VALUES (3, 'Pediatrics', 'طب الأطفال', ARRAY['اطفال', 'أطفال', 'عيال', 'kids'], ARRAY['kids', 'pediatrics', 'اطفال', 'طب الاطفال', 'عيال']) ON CONFLICT (id) DO NOTHING;

INSERT INTO specialties (id, name_en, name_ar, synonyms, search_terms) VALUES (4, 'Orthopedics', 'جراحة العظام', ARRAY['عظام', 'عضم', 'bones'], ARRAY['bones', 'orthopedics', 'جراحه العظام', 'عضم', 'عظام']) ON CONFLICT (id) DO NOTHING;

INSERT INTO specialties (id, name_en, name_ar, synonyms, search_terms) VALUES (5, 'Internal Medicine', 'الباطنة', ARRAY['باطنة', 'باطنه', 'internal'], ARRAY['internal', 'internal medicine', 'الباطنه', 'باطنه']) ON CONFLICT (id) DO NOTHING;

INSERT INTO doctors (id, name_en, name_ar, title_en, title_ar, specialty_id, bio_en, bio_ar, languages, consultation_fee, working_days, shift_start, shift_end, is_active) VALUES (1, 'Dr. Amal Nour', 'د. أمل نور', 'Consultant in Cardiology', 'استشاري أمراض القلب', 1, 'Fictional consultant profile for the clinic demo.', 'دكتور في العيادة التجريبية. البيانات دي للتجربة بس.', ARRAY['ar', 'en'], 350, ARRAY[6, 7, 1, 2, 3], '09:00:00', '14:00:00', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO doctors (id, name_en, name_ar, title_en, title_ar, specialty_id, bio_en, bio_ar, languages, consultation_fee, working_days, shift_start, shift_end, is_active) VALUES (2, 'Dr. Karim Salem', 'د. كريم سالم', 'Consultant in Cardiology', 'استشاري أمراض القلب', 1, 'Fictional consultant profile for the clinic demo.', 'دكتور في العيادة التجريبية. البيانات دي للتجربة بس.', ARRAY['ar', 'en'], 350, ARRAY[6, 7, 1, 2, 3], '09:00:00', '14:00:00', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO doctors (id, name_en, name_ar, title_en, title_ar, specialty_id, bio_en, bio_ar, languages, consultation_fee, working_days, shift_start, shift_end, is_active) VALUES (3, 'Dr. Salma Hany', 'د. سلمى هاني', 'Consultant in Dermatology', 'استشاري الأمراض الجلدية', 2, 'Fictional consultant profile for the clinic demo.', 'دكتور في العيادة التجريبية. البيانات دي للتجربة بس.', ARRAY['ar', 'en'], 350, ARRAY[6, 7, 1, 2, 3], '09:00:00', '14:00:00', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO doctors (id, name_en, name_ar, title_en, title_ar, specialty_id, bio_en, bio_ar, languages, consultation_fee, working_days, shift_start, shift_end, is_active) VALUES (4, 'Dr. Tarek Ali', 'د. طارق علي', 'Consultant in Dermatology', 'استشاري الأمراض الجلدية', 2, 'Fictional consultant profile for the clinic demo.', 'دكتور في العيادة التجريبية. البيانات دي للتجربة بس.', ARRAY['ar', 'en'], 350, ARRAY[6, 7, 1, 2, 3], '09:00:00', '14:00:00', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO doctors (id, name_en, name_ar, title_en, title_ar, specialty_id, bio_en, bio_ar, languages, consultation_fee, working_days, shift_start, shift_end, is_active) VALUES (5, 'Dr. Mariam Adel', 'د. مريم عادل', 'Consultant in Pediatrics', 'استشاري طب الأطفال', 3, 'Fictional consultant profile for the clinic demo.', 'دكتور في العيادة التجريبية. البيانات دي للتجربة بس.', ARRAY['ar', 'en'], 350, ARRAY[6, 7, 1, 2, 3], '09:00:00', '14:00:00', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO doctors (id, name_en, name_ar, title_en, title_ar, specialty_id, bio_en, bio_ar, languages, consultation_fee, working_days, shift_start, shift_end, is_active) VALUES (6, 'Dr. Omar Fathy', 'د. عمر فتحي', 'Consultant in Pediatrics', 'استشاري طب الأطفال', 3, 'Fictional consultant profile for the clinic demo.', 'دكتور في العيادة التجريبية. البيانات دي للتجربة بس.', ARRAY['ar', 'en'], 350, ARRAY[6, 7, 1, 2, 3], '09:00:00', '14:00:00', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO doctors (id, name_en, name_ar, title_en, title_ar, specialty_id, bio_en, bio_ar, languages, consultation_fee, working_days, shift_start, shift_end, is_active) VALUES (7, 'Dr. Heba Samir', 'د. هبة سمير', 'Consultant in Orthopedics', 'استشاري جراحة العظام', 4, 'Fictional consultant profile for the clinic demo.', 'دكتور في العيادة التجريبية. البيانات دي للتجربة بس.', ARRAY['ar', 'en'], 350, ARRAY[6, 7, 1, 2, 3], '09:00:00', '14:00:00', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO doctors (id, name_en, name_ar, title_en, title_ar, specialty_id, bio_en, bio_ar, languages, consultation_fee, working_days, shift_start, shift_end, is_active) VALUES (8, 'Dr. Youssef Nabil', 'د. يوسف نبيل', 'Consultant in Orthopedics', 'استشاري جراحة العظام', 4, 'Fictional consultant profile for the clinic demo.', 'دكتور في العيادة التجريبية. البيانات دي للتجربة بس.', ARRAY['ar', 'en'], 350, ARRAY[6, 7, 1, 2, 3], '09:00:00', '14:00:00', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO doctors (id, name_en, name_ar, title_en, title_ar, specialty_id, bio_en, bio_ar, languages, consultation_fee, working_days, shift_start, shift_end, is_active) VALUES (9, 'Dr. Nadia Hassan', 'د. نادية حسن', 'Consultant in Internal Medicine', 'استشاري الباطنة', 5, 'Fictional consultant profile for the clinic demo.', 'دكتور في العيادة التجريبية. البيانات دي للتجربة بس.', ARRAY['ar', 'en'], 350, ARRAY[6, 7, 1, 2, 3], '09:00:00', '14:00:00', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO doctors (id, name_en, name_ar, title_en, title_ar, specialty_id, bio_en, bio_ar, languages, consultation_fee, working_days, shift_start, shift_end, is_active) VALUES (10, 'Dr. Mostafa Khaled', 'د. مصطفى خالد', 'Consultant in Internal Medicine', 'استشاري الباطنة', 5, 'Fictional consultant profile for the clinic demo.', 'دكتور في العيادة التجريبية. البيانات دي للتجربة بس.', ARRAY['ar', 'en'], 350, ARRAY[6, 7, 1, 2, 3], '09:00:00', '14:00:00', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (1, 'General Consultation', 'كشف عام', 'consultation', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (2, 'Echocardiogram', 'إيكو على القلب', 'diagnostic', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 600, 45, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (3, 'ECG', 'رسم قلب', 'diagnostic', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (4, 'Skin Consultation', 'كشف جلدية', 'consultation', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (5, 'Pediatric Consultation', 'كشف أطفال', 'consultation', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (6, 'Orthopedic Consultation', 'كشف عظام', 'consultation', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (7, 'Internal Medicine Consultation', 'كشف باطنة', 'consultation', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (8, 'Abdominal Ultrasound', 'سونار على البطن', 'diagnostic', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (9, 'Complete Blood Count', 'صورة دم كاملة', 'laboratory', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (10, 'Blood Glucose Test', 'تحليل سكر', 'laboratory', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (11, 'Lipid Profile', 'تحليل دهون', 'laboratory', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (12, 'Liver Function Tests', 'تحاليل وظائف كبد', 'laboratory', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (13, 'Kidney Function Tests', 'تحاليل وظائف كلى', 'laboratory', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (14, 'Thyroid Test', 'تحليل الغدة الدرقية', 'laboratory', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name_en, name_ar, category, description_en, description_ar, price, duration_minutes, preparation_instructions_en, preparation_instructions_ar, is_available) VALUES (15, 'Urine Analysis', 'تحليل بول', 'laboratory', 'Synthetic service description for demonstration only.', 'خدمة في العيادة التجريبية. التفاصيل والأسعار للتجربة بس.', 200, 30, 'Contact clinic staff for preparation instructions.', 'اسأل موظف العيادة عن تعليمات التحضير.', true) ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('specialties', 'id'), GREATEST((SELECT max(id) FROM specialties), nextval(pg_get_serial_sequence('specialties', 'id'))), true);

SELECT setval(pg_get_serial_sequence('doctors', 'id'), GREATEST((SELECT max(id) FROM doctors), nextval(pg_get_serial_sequence('doctors', 'id'))), true);

SELECT setval(pg_get_serial_sequence('services', 'id'), GREATEST((SELECT max(id) FROM services), nextval(pg_get_serial_sequence('services', 'id'))), true);

COMMIT;

SELECT version_num FROM "clinic".alembic_version;

SELECT 'specialties' AS catalog, count(*) FROM "clinic".specialties UNION ALL SELECT 'doctors', count(*) FROM "clinic".doctors UNION ALL SELECT 'services', count(*) FROM "clinic".services;
