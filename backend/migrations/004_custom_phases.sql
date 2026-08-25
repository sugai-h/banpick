-- カスタムフェーズ列を追加（既に存在する場合はスキップ）
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS custom_phases TEXT DEFAULT NULL;

-- step_index カラムは不要になったが互換性のため残す
