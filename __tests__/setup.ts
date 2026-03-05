// Jest setup file

jest.mock('h3-js', () => ({
  latLngToCell: jest.fn(() => 'mock-hex-index'),
  cellToLatLng: jest.fn(() => [0, 0]),
  getRes0Cells: jest.fn(() => ['mock-res0']),
  cellToChildren: jest.fn(() => ['mock-hex-index']),
  gridDistance: jest.fn(() => 1),
  gridDisk: jest.fn(() => ['mock-hex-index']),
  isValidCell: jest.fn(() => true),
  cellToParent: jest.fn(() => 'mock-parent'),
}));
