-- Remove duplicate templates created by the old NewReport auto-create flow.
-- For each period_type, keep only the template that has a current_version_id
-- (i.e. has been properly published), or if none are published, keep the
-- most recently created one. Delete the rest.

DELETE FROM templates
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      period_type,
      current_version_id,
      created_at,
      ROW_NUMBER() OVER (
        PARTITION BY period_type
        ORDER BY
          -- prefer rows that have a published version
          (current_version_id IS NOT NULL) DESC,
          -- then newest
          created_at DESC
      ) AS rn
    FROM templates
  ) ranked
  WHERE rn > 1
);
