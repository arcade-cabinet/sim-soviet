import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { animate } from 'animejs/animation';
import { BUILDING_TYPES, COLORS, GRID_SIZE, TILE_HEIGHT, TILE_WIDTH } from '../config';
import type { GameState } from '../game/GameState';

export class IsometricRenderer {
  private highlightMesh: Mesh | null = null;
  private materials: Map<string, StandardMaterial> = new Map();

  constructor(
    private scene: Scene,
    private gameState: GameState
  ) {
    this.createMaterials();
  }

  private createMaterials(): void {
    // Grass material
    const grassMat = new StandardMaterial('grass', this.scene);
    grassMat.diffuseColor = Color3.FromHexString(COLORS.grass);
    grassMat.specularColor = new Color3(0, 0, 0);
    this.materials.set('grass', grassMat);

    // Road material
    const roadMat = new StandardMaterial('road', this.scene);
    roadMat.diffuseColor = Color3.FromHexString(COLORS.road);
    roadMat.specularColor = new Color3(0, 0, 0);
    this.materials.set('road', roadMat);

    // Foundation material
    const foundationMat = new StandardMaterial('foundation', this.scene);
    foundationMat.diffuseColor = Color3.FromHexString(COLORS.foundation);
    foundationMat.specularColor = new Color3(0, 0, 0);
    this.materials.set('foundation', foundationMat);

    // Building materials
    const concreteMat = new StandardMaterial('concrete', this.scene);
    concreteMat.diffuseColor = new Color3(0.46, 0.46, 0.46);
    this.materials.set('concrete', concreteMat);

    const powerMat = new StandardMaterial('power', this.scene);
    powerMat.diffuseColor = new Color3(0.24, 0.15, 0.14);
    this.materials.set('power', powerMat);

    const farmMat = new StandardMaterial('farm', this.scene);
    farmMat.diffuseColor = new Color3(0.2, 0.42, 0.12);
    this.materials.set('farm', farmMat);

    const gulagMat = new StandardMaterial('gulag', this.scene);
    gulagMat.diffuseColor = new Color3(0.72, 0.11, 0.11);
    this.materials.set('gulag', gulagMat);

    // Highlight material
    const highlightMat = new StandardMaterial('highlight', this.scene);
    highlightMat.diffuseColor = new Color3(1, 1, 1);
    highlightMat.alpha = 0.3;
    this.materials.set('highlight', highlightMat);
  }

  public initialize(): void {
    this.createGrid();
    this.createHighlightMesh();
  }

  private createGrid(): void {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.gameState.getCell(x, y);
        if (!cell) continue;

        // Create tile mesh
        const tile = MeshBuilder.CreateBox(
          `tile_${x}_${y}`,
          { width: TILE_WIDTH, height: 0.1, depth: TILE_HEIGHT },
          this.scene
        );

        // Position in isometric grid
        tile.position = this.gridToWorld(x, y, 0);
        tile.material = this.materials.get('grass') ?? null;

        cell.mesh = tile;
      }
    }
  }

  public gridToWorld(gridX: number, gridY: number, gridZ: number): Vector3 {
    const x = (gridX - gridY) * (TILE_WIDTH / 2);
    const z = (gridX + gridY) * (TILE_HEIGHT / 2);
    const y = gridZ * 2;
    return new Vector3(x, y, z);
  }

  public worldToGrid(worldPos: Vector3): { x: number; y: number } {
    const gridX = Math.floor((worldPos.x / TILE_WIDTH + worldPos.z / TILE_HEIGHT) / 2);
    const gridY = Math.floor((worldPos.z / TILE_HEIGHT - worldPos.x / TILE_WIDTH) / 2);
    return { x: gridX, y: gridY };
  }

  private createHighlightMesh(): void {
    this.highlightMesh = MeshBuilder.CreateBox(
      'highlight',
      { width: TILE_WIDTH, height: 0.2, depth: TILE_HEIGHT },
      this.scene
    );
    this.highlightMesh.position.y = 0.15;
    this.highlightMesh.material = this.materials.get('highlight') ?? null;
    this.highlightMesh.isVisible = false;
  }

  public showHighlight(gridX: number, gridY: number): void {
    if (!this.highlightMesh) return;
    if (gridX < 0 || gridY < 0 || gridX >= GRID_SIZE || gridY >= GRID_SIZE) {
      this.highlightMesh.isVisible = false;
      return;
    }
    const worldPos = this.gridToWorld(gridX, gridY, 0);
    this.highlightMesh.position.x = worldPos.x;
    this.highlightMesh.position.z = worldPos.z;
    this.highlightMesh.isVisible = true;
  }

  public hideHighlight(): void {
    if (this.highlightMesh) {
      this.highlightMesh.isVisible = false;
    }
  }

  public createBuilding(gridX: number, gridY: number, type: string): void {
    const cell = this.gameState.getCell(gridX, gridY);
    if (!cell) return;

    const buildingInfo = BUILDING_TYPES[type];
    if (!buildingInfo) return;

    // Update cell material
    if (cell.mesh) {
      if (type === 'road') {
        cell.mesh.material = this.materials.get('road') ?? null;
      } else {
        cell.mesh.material = this.materials.get('foundation') ?? null;
      }
    }

    // Create building mesh
    if (type !== 'road') {
      let height = 2;
      let materialName = 'concrete';

      if (type === 'power') {
        height = 4;
        materialName = 'power';
      } else if (type === 'housing') {
        height = 5;
      } else if (type === 'farm') {
        height = 1;
        materialName = 'farm';
      } else if (type === 'gulag') {
        height = 1.5;
        materialName = 'gulag';
      }

      const building = MeshBuilder.CreateBox(
        `building_${gridX}_${gridY}`,
        { width: TILE_WIDTH * 0.8, height, depth: TILE_HEIGHT * 0.8 },
        this.scene
      );

      const worldPos = this.gridToWorld(gridX, gridY, 0);
      building.position = new Vector3(worldPos.x, height / 2 + 0.1, worldPos.z);
      building.material =
        this.materials.get(materialName) ?? this.materials.get('concrete') ?? null;

      // Animate building appearance
      building.scaling = new Vector3(0.1, 0.1, 0.1);
      animate(building.scaling, {
        x: 1,
        y: 1,
        z: 1,
        duration: 300,
        ease: 'outBack',
      });

      const buildingObj = this.gameState.getBuildingAt(gridX, gridY);
      if (buildingObj) {
        buildingObj.mesh = building;
      }
    }
  }

  public removeBuilding(gridX: number, gridY: number): void {
    const cell = this.gameState.getCell(gridX, gridY);
    if (!cell) return;

    const building = this.gameState.getBuildingAt(gridX, gridY);
    if (building?.mesh) {
      animate(building.mesh.scaling, {
        x: 0,
        y: 0,
        z: 0,
        duration: 200,
        ease: 'inBack',
        onComplete: () => {
          if (building.mesh) {
            building.mesh.dispose();
          }
        },
      });
    }

    // Reset cell material
    if (cell.mesh) {
      cell.mesh.material = this.materials.get('grass') ?? null;
    }
  }

  public update(): void {
    // Update building states (powered/unpowered visual feedback)
    this.gameState.buildings.forEach((building) => {
      if (building.mesh && !building.powered) {
        // Darken unpowered buildings
        const mat = building.mesh.material as StandardMaterial;
        if (mat) {
          const darkFactor = 0.3 + 0.2 * Math.sin(Date.now() / 500);
          mat.alpha = darkFactor;
        }
      } else if (building.mesh && building.powered) {
        const mat = building.mesh.material as StandardMaterial;
        if (mat) {
          mat.alpha = 1;
        }
      }
    });
  }

  public onResize(): void {
    // Handle any resize-specific logic if needed
  }
}
