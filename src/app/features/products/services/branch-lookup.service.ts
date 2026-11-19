import { Injectable } from '@angular/core';
import { Branch, BranchInput } from '../../settings/models/org.models';
import { CrudApi } from './products.service';

/** Reorder level tab ke liye branches ki list (sirf padhne ke liye). */
@Injectable({ providedIn: 'root' })
export class BranchLookupService extends CrudApi<Branch, BranchInput> {
  protected readonly path = 'branches';
}