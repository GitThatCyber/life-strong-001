-- Illustrative starter content only; no original MTB prescription was supplied.
INSERT INTO exercises (id, name, equipment, muscle_focus, measurement_type) VALUES
('10000000-0000-4000-8000-000000000001', 'Goblet squat', 'Dumbbell', 'Legs', 'weight_reps'),
('10000000-0000-4000-8000-000000000002', 'Push-up', 'Bodyweight', 'Upper body', 'reps'),
('10000000-0000-4000-8000-000000000003', 'Plank', 'Mat', 'Core', 'duration'),
('10000000-0000-4000-8000-000000000004', 'Easy ride', 'Bicycle', 'Endurance', 'distance_duration')
ON CONFLICT (id) DO NOTHING;
INSERT INTO workout_templates (id, name, description) VALUES
('20000000-0000-4000-8000-000000000001', 'Starter strength', 'Illustrative template. Adjust to your needs; this is not the original MTB plan.'),
('20000000-0000-4000-8000-000000000002', 'Starter endurance', 'Illustrative easy-effort session.')
ON CONFLICT (id) DO NOTHING;
INSERT INTO template_exercises (template_id, exercise_id, position, prescription, rest_seconds) VALUES
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 0, 'Choose a comfortable load and repetitions', 60),
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 1, 'Choose a manageable number of repetitions', 60),
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 2, 'Choose a comfortable duration', 60),
('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 0, 'Easy effort; choose your duration and distance', 60)
ON CONFLICT (template_id, position) DO NOTHING;
INSERT INTO programs (id, name, description, weeks) VALUES
('30000000-0000-4000-8000-000000000001', 'Illustrative 12-week MTB off-season starter', 'Placeholder structure with repeated starter sessions. Replace with your actual training prescriptions.', 12)
ON CONFLICT (id) DO NOTHING;
INSERT INTO program_schedule (program_id, template_id, week, day)
SELECT '30000000-0000-4000-8000-000000000001'::uuid, t.template_id::uuid, w.week, t.day
FROM generate_series(1,12) AS w(week)
CROSS JOIN (VALUES ('20000000-0000-4000-8000-000000000001',1), ('20000000-0000-4000-8000-000000000002',4)) AS t(template_id,day)
ON CONFLICT (program_id, week, day) DO NOTHING;
