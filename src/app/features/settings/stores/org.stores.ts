import { Injectable, inject } from '@angular/core';
import { CrudStore } from '../../products/stores/products.stores';
import { LocationInput, WarehouseLocation } from '../models/location.models';
import { Branch, BranchInput, Warehouse, WarehouseInput } from '../models/org.models';
import { BranchesService, LocationsService, WarehousesService } from '../services/org.service';

@Injectable({ providedIn: 'root' })
export class BranchesStore extends CrudStore<Branch, BranchInput> {
  protected readonly api = inject(BranchesService);
}

@Injectable({ providedIn: 'root' })
export class WarehousesStore extends CrudStore<Warehouse, WarehouseInput> {
  protected readonly api = inject(WarehousesService);
}

@Injectable({ providedIn: 'root' })
export class LocationsStore extends CrudStore<WarehouseLocation, LocationInput> {
  protected readonly api = inject(LocationsService);
}