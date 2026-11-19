import { Injectable } from '@angular/core';
import { CrudApi } from '../../products/services/products.service';
import { Branch, BranchInput, Warehouse, WarehouseInput } from '../models/org.models';
import { LocationInput, WarehouseLocation } from '../models/location.models';

@Injectable({ providedIn: 'root' })
export class BranchesService extends CrudApi<Branch, BranchInput> {
  protected readonly path = 'branches';
}

@Injectable({ providedIn: 'root' })
export class WarehousesService extends CrudApi<Warehouse, WarehouseInput> {
  protected readonly path = 'warehouses';
}

@Injectable({ providedIn: 'root' })
export class LocationsService extends CrudApi<WarehouseLocation, LocationInput> {
  protected readonly path = 'locations';
}