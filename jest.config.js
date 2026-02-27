module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/__tests__'],
  testPathIgnorePatterns: ['/node_modules/', '/archive/', 'App.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!(@babylonjs|react-native|@react-native|reactylon|expo|@expo|expo-modules-core)/)',
  ],
};
