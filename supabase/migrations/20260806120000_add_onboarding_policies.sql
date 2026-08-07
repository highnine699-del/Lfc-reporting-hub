-- Adds missing INSERT policies for onboarding flow.
-- These allow authenticated users to create their initial station and profile.

-- Allow authenticated users to create a station (for new pastor onboarding)
CREATE POLICY "Authenticated users can create a station"
  ON stations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow users to insert their own profile (for onboarding)
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());
