-- enforce allowed state values and picked_team values, and FK for picked_by
-- DO $$ ブロックで「既に存在する場合はスキップ」にして冪等化

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'room_char_states_state_check'
      AND conrelid = 'room_char_states'::regclass
  ) THEN
    ALTER TABLE room_char_states
      ADD CONSTRAINT room_char_states_state_check
        CHECK (state IN ('available','banned','picked'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'room_char_states_picked_team_check'
      AND conrelid = 'room_char_states'::regclass
  ) THEN
    ALTER TABLE room_char_states
      ADD CONSTRAINT room_char_states_picked_team_check
        CHECK (picked_team IN ('A','B') OR picked_team IS NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'room_char_states_picked_by_fkey'
      AND conrelid = 'room_char_states'::regclass
  ) THEN
    ALTER TABLE room_char_states
      ADD CONSTRAINT room_char_states_picked_by_fkey
        FOREIGN KEY (picked_by) REFERENCES players(id) ON DELETE SET NULL;
  END IF;
END $$;
