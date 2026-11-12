-- Exact ride pins and area centres. `rides` gets a pickup and a destination point, `areas` one centre,
-- each as two nullable REAL columns, with a CHECK that both are set or both null and a set point is inside
-- the greater-Dhaka box (`MAP_BOUNDS` in src/shared/geo.ts, kept in step by a test).
--
-- Why ADD COLUMN and not the table rebuild drizzle-kit generates: `areas` is referenced by the foreign
-- keys of `rides` (and of itself through `parent_id`), and D1 enforces foreign keys, so DROP TABLE areas
-- would fail or cascade. Rebuilding `rides` would also rewrite every ride for nothing. SQLite allows a
-- column CHECK on ADD COLUMN, and a column CHECK may name other columns, so the longitude column carries
-- the both-or-none rule and the range of both (it is added second, so `lat` already exists), and the
-- latitude column carries its own range. SQLite runs every CHECK of a row on insert and update, so
-- setting only one half is refused. The schema in src/server/db/schema.ts states the same rule as one
-- table-level check (`areas_point_check`, `rides_pickup_point_check`, `rides_destination_point_check`),
-- which is what the snapshot records. The two forms are equivalent.
ALTER TABLE `rides` ADD `pickup_lat` real CHECK (`pickup_lat` is null or `pickup_lat` between 23.58 and 24.08);--> statement-breakpoint
ALTER TABLE `rides` ADD `pickup_lng` real CHECK ((`pickup_lat` is null) = (`pickup_lng` is null) and (`pickup_lng` is null or `pickup_lng` between 90.22 and 90.62));--> statement-breakpoint
ALTER TABLE `rides` ADD `destination_lat` real CHECK (`destination_lat` is null or `destination_lat` between 23.58 and 24.08);--> statement-breakpoint
ALTER TABLE `rides` ADD `destination_lng` real CHECK ((`destination_lat` is null) = (`destination_lng` is null) and (`destination_lng` is null or `destination_lng` between 90.22 and 90.62));--> statement-breakpoint
ALTER TABLE `areas` ADD `lat` real CHECK (`lat` is null or `lat` between 23.58 and 24.08);--> statement-breakpoint
ALTER TABLE `areas` ADD `lng` real CHECK ((`lat` is null) = (`lng` is null) and (`lng` is null or `lng` between 90.22 and 90.62));--> statement-breakpoint
-- The area centres, from data/areas/points.json (OpenStreetMap via scripts/area-points.ts; "Outside Dhaka" has none).
UPDATE `areas` SET `lat` = 23.81667, `lng` = 90.42943 WHERE `slug` = 'bashundhara-r-a';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.77376, `lng` = 90.35743 WHERE `slug` = 'adabor';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.76575, `lng` = 90.4452 WHERE `slug` = 'aftabnagar';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.77843, `lng` = 90.38005 WHERE `slug` = 'agargaon';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.84681, `lng` = 90.4145 WHERE `slug` = 'airport-kawla';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.78649, `lng` = 90.33018 WHERE `slug` = 'aminbazar';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.89699, `lng` = 90.32896 WHERE `slug` = 'ashulia';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.72529, `lng` = 90.38346 WHERE `slug` = 'azimpur';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.77654, `lng` = 90.4463 WHERE `slug` = 'badda';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.79032, `lng` = 90.4077 WHERE `slug` = 'banani';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.76571, `lng` = 90.42301 WHERE `slug` = 'banasree';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.80336, `lng` = 90.42026 WHERE `slug` = 'baridhara';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.73933, `lng` = 90.43752 WHERE `slug` = 'basabo';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.79998, `lng` = 90.47573 WHERE `slug` = 'beraid';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.81975, `lng` = 90.39758 WHERE `slug` = 'cantonment';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.71532, `lng` = 90.39544 WHERE `slug` = 'chawkbazar';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.86059, `lng` = 90.42733 WHERE `slug` = 'dakshinkhan';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.72849, `lng` = 90.4974 WHERE `slug` = 'demra';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.75354, `lng` = 90.37031 WHERE `slug` = 'dhanmondi';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.87385, `lng` = 90.36742 WHERE `slug` = 'diabari';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.81388, `lng` = 90.41083 WHERE `slug` = 'dohs-baridhara';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.7935, `lng` = 90.3975 WHERE `slug` = 'dohs-banani';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.83581, `lng` = 90.35973 WHERE `slug` = 'dohs-mirpur';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.78356, `lng` = 90.39184 WHERE `slug` = 'dohs-mohakhali';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.73899, `lng` = 90.38724 WHERE `slug` = 'elephant-road';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.75904, `lng` = 90.38711 WHERE `slug` = 'farmgate';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.65035, `lng` = 90.47579 WHERE `slug` = 'fatullah';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.78337, `lng` = 90.34021 WHERE `slug` = 'gabtoli';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.99972, `lng` = 90.4184 WHERE `slug` = 'gazipur';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.70291, `lng` = 90.42408 WHERE `slug` = 'gendaria';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.79218, `lng` = 90.41555 WHERE `slug` = 'gulshan';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.73198, `lng` = 90.36841 WHERE `slug` = 'hazaribagh';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.79353, `lng` = 90.27087 WHERE `slug` = 'hemayetpur';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.7094, `lng` = 90.43381 WHERE `slug` = 'jatrabari';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.74032, `lng` = 90.37205 WHERE `slug` = 'jigatola';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.69625, `lng` = 90.43431 WHERE `slug` = 'jurain';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.68518, `lng` = 90.44896 WHERE `slug` = 'kadamtali';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.78916, `lng` = 90.38562 WHERE `slug` = 'kafrul';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.73854, `lng` = 90.40715 WHERE `slug` = 'kakrail';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.74795, `lng` = 90.38139 WHERE `slug` = 'kalabagan';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.78068, `lng` = 90.36133 WHERE `slug` = 'kallyanpur';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.70621, `lng` = 90.52116 WHERE `slug` = 'kanchpur';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.75143, `lng` = 90.39486 WHERE `slug` = 'kawran-bazar';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.7978, `lng` = 90.3728 WHERE `slug` = 'kazipara';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.7005, `lng` = 90.38264 WHERE `slug` = 'keraniganj';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.75065, `lng` = 90.42328 WHERE `slug` = 'khilgaon';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.83513, `lng` = 90.43511 WHERE `slug` = 'khilkhet';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.71582, `lng` = 90.46729 WHERE `slug` = 'konapara';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.709, `lng` = 90.406 WHERE `slug` = 'kotwali';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.81814, `lng` = 90.42213 WHERE `slug` = 'kuril';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.71884, `lng` = 90.38815 WHERE `slug` = 'lalbagh';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.74707, `lng` = 90.41377 WHERE `slug` = 'malibagh';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.72997, `lng` = 90.44004 WHERE `slug` = 'manda';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.70527, `lng` = 90.46063 WHERE `slug` = 'matuail';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.77221, `lng` = 90.42608 WHERE `slug` = 'merul-badda';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.82029, `lng` = 90.37104 WHERE `slug` = 'mirpur';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.74772, `lng` = 90.40092 WHERE `slug` = 'moghbazar';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.77991, `lng` = 90.40832 WHERE `slug` = 'mohakhali';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.75939, `lng` = 90.36633 WHERE `slug` = 'mohammadpur';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.72726, `lng` = 90.4212 WHERE `slug` = 'motijheel';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.72912, `lng` = 90.43357 WHERE `slug` = 'mugda';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.62367, `lng` = 90.49881 WHERE `slug` = 'narayanganj';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.73324, `lng` = 90.38437 WHERE `slug` = 'new-market';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.77332, `lng` = 90.40976 WHERE `slug` = 'niketan';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.83026, `lng` = 90.41787 WHERE `slug` = 'nikunja';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.70589, `lng` = 90.40929 WHERE `slug` = 'old-dhaka-sadarghat';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.82464, `lng` = 90.36759 WHERE `slug` = 'pallabi';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.73176, `lng` = 90.41142 WHERE `slug` = 'paltan';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.75287, `lng` = 90.38275 WHERE `slug` = 'panthapath';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.69178, `lng` = 90.4287 WHERE `slug` = 'postogola';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.85342, `lng` = 90.50142 WHERE `slug` = 'purbachal';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.76832, `lng` = 90.42196 WHERE `slug` = 'rampura';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.74484, `lng` = 90.36273 WHERE `slug` = 'rayer-bazar';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.79237, `lng` = 90.52033 WHERE `slug` = 'rupganj';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.73725, `lng` = 90.42936 WHERE `slug` = 'sabujbag';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.8477, `lng` = 90.2587 WHERE `slug` = 'savar';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.71123, `lng` = 90.42868 WHERE `slug` = 'sayedabad';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.73403, `lng` = 90.40767 WHERE `slug` = 'segunbagicha';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.73734, `lng` = 90.39617 WHERE `slug` = 'shahbag';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.74074, `lng` = 90.42401 WHERE `slug` = 'shahjahanpur';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.74157, `lng` = 90.41206 WHERE `slug` = 'shantinagar';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.77793, `lng` = 90.37401 WHERE `slug` = 'sher-e-bangla-nagar';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.79096, `lng` = 90.37551 WHERE `slug` = 'shewrapara';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.7744, `lng` = 90.36543 WHERE `slug` = 'shyamoli';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.68619, `lng` = 90.43909 WHERE `slug` = 'shyampur';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.68497, `lng` = 90.516 WHERE `slug` = 'siddhirganj';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.70645, `lng` = 90.41687 WHERE `slug` = 'sutrapur';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.76282, `lng` = 90.3913 WHERE `slug` = 'tejgaon';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.76488, `lng` = 90.4058 WHERE `slug` = 'tejgaon-industrial-area';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.90849, `lng` = 90.398 WHERE `slug` = 'tongi';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.86933, `lng` = 90.39269 WHERE `slug` = 'uttara';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.89237, `lng` = 90.44171 WHERE `slug` = 'uttarkhan';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.79856, `lng` = 90.42464 WHERE `slug` = 'vatara';--> statement-breakpoint
UPDATE `areas` SET `lat` = 23.71866, `lng` = 90.4154 WHERE `slug` = 'wari';--> statement-breakpoint
