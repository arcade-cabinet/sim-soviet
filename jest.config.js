module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/__tests__'],
  testPathIgnorePatterns: ['/node_modules/', '/archive/', 'App.test.tsx', '__tests__/playthrough/helpers.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@react-three|three|react-native|@react-native|expo|@expo|expo-modules-core)/)',
  ],
};
