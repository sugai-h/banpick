-- enforce allowed state values and picked_team values, and FK for picked_by
ALTER TABLE room_char_states
  ADD CONSTRAINT room_char_states_state_check CHECK (state IN ('available','banned','picked'));

ALTER TABLE room_char_states
  ADD CONSTRAINT room_char_states_picked_team_check CHECK (picked_team IN ('A','B') OR picked_team IS NULL);

ALTER TABLE room_char_states
  ADD CONSTRAINT room_char_states_picked_by_fkey FOREIGN KEY (picked_by) REFERENCES players(id) ON DELETE SET NULL;
