-- characters table
CREATE TABLE IF NOT EXISTS characters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  icon_url TEXT,
  role TEXT
);

-- rooms
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin TEXT NOT NULL,
  status TEXT DEFAULT 'lobby',
  created_at TIMESTAMP DEFAULT now()
);

-- players
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  team TEXT,
  is_host BOOLEAN DEFAULT false,
  socket_id TEXT,
  joined_at TIMESTAMP DEFAULT now()
);

-- room char states
CREATE TABLE IF NOT EXISTS room_char_states (
  id SERIAL PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  character_id INT REFERENCES characters(id),
  state TEXT NOT NULL,
  picked_by UUID NULL,
  picked_team TEXT NULL,
  UNIQUE(room_id, character_id)
);
