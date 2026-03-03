import type { Page, Route } from '@playwright/test';

type UserFixture = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type CatalogState = {
  categories: Array<{ id: string; name: string }>;
  vendors: Array<{ id: string; name: string; taxCode: string | null; phone: string | null; email: string | null; address: string | null }>;
  models: Array<{
    id: string;
    model: string;
    brand: string | null;
    categoryId: string | null;
    specVersionId: string | null;
    vendorId: string | null;
    spec: Record<string, unknown>;
  }>;
  locations: Array<{ id: string; name: string; parentId: string | null; path: string }>;
};

type MockOptions = {
  user?: Partial<UserFixture>;
};

const defaultUser: UserFixture = {
  id: 'u-e2e-1',
  email: 'qa@example.com',
  name: 'QA User',
  role: 'admin'
};

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseJsonBody(request: { postData(): string | null }): Record<string, unknown> {
  const raw = request.postData();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function fulfillJson(route: Route, data: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data)
  });
}

export async function seedAuthenticatedSession(page: Page, userOverride?: Partial<UserFixture>): Promise<void> {
  const user = { ...defaultUser, ...userOverride };
  await page.addInitScript((seedUser: UserFixture) => {
    localStorage.setItem('authToken', 'e2e-access-token');
    localStorage.setItem('refreshToken', 'e2e-refresh-token');
    localStorage.setItem('userId', seedUser.id);
    localStorage.setItem('userEmail', seedUser.email);
    localStorage.setItem('userName', seedUser.name);
    localStorage.setItem('userRole', seedUser.role);
  }, user);
}

export async function installApiMocks(page: Page, options: MockOptions = {}): Promise<void> {
  const user = { ...defaultUser, ...(options.user ?? {}) };
  const catalogs: CatalogState = {
    categories: [
      { id: 'cat-laptop', name: 'Laptop' },
      { id: 'cat-network', name: 'Network' }
    ],
    vendors: [
      {
        id: 'vendor-dell',
        name: 'Dell',
        taxCode: null,
        phone: null,
        email: null,
        address: null
      }
    ],
    models: [
      {
        id: 'model-7420',
        model: 'Latitude 7420',
        brand: null,
        categoryId: 'cat-laptop',
        specVersionId: null,
        vendorId: 'vendor-dell',
        spec: {}
      }
    ],
    locations: [
      { id: 'loc-hq', name: 'HQ', parentId: null, path: '/hq' }
    ]
  };

  const assets = [
    {
      id: 'asset-001',
      assetCode: 'ASSET-001',
      status: 'in_stock',
      modelId: 'model-7420',
      categoryId: 'cat-laptop',
      vendorId: 'vendor-dell',
      locationId: 'loc-hq',
      serialNo: 'SN-001',
      macAddress: null,
      mgmtIp: null,
      hostname: 'host-001',
      vlanId: null,
      switchName: null,
      switchPort: null,
      purchaseDate: null,
      warrantyEnd: null,
      notes: null,
      modelName: 'Latitude 7420',
      modelBrand: null,
      categoryName: 'Laptop',
      vendorName: 'Dell',
      locationName: 'HQ',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const warehouses = [
    { id: 'wh-main', code: 'WH-MAIN', name: 'Main Warehouse', locationId: 'loc-hq', createdAt: new Date().toISOString() }
  ];

  const stockView = [
    {
      warehouseId: 'wh-main',
      warehouseCode: 'WH-MAIN',
      warehouseName: 'Main Warehouse',
      partId: 'part-1',
      partCode: 'PT-001',
      partName: 'SSD 1TB',
      onHand: 8,
      reserved: 1,
      available: 7,
      uom: 'pcs',
      minLevel: 2
    }
  ];

  await page.route('**/*', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const rawPath = url.pathname;
    const path = rawPath.startsWith('/api/') ? rawPath.slice(4) : rawPath;

    if (!path.startsWith('/v1/')) {
      await route.continue();
      return;
    }

    if (path.endsWith('/v1/auth/login') && method === 'POST') {
      await fulfillJson(route, {
        data: {
          accessToken: 'e2e-access-token',
          refreshToken: 'e2e-refresh-token',
          expiresIn: 3600,
          user
        }
      });
      return;
    }

    if (path.endsWith('/v1/assets/catalogs') && method === 'GET') {
      await fulfillJson(route, { data: catalogs });
      return;
    }

    if (path.endsWith('/v1/assets/catalogs/categories') && method === 'POST') {
      const body = parseJsonBody(request);
      const category = {
        id: randomId('cat'),
        name: String(body.name ?? 'Unnamed category')
      };
      catalogs.categories.push(category);
      await fulfillJson(route, {
        data: {
          category,
          versionId: randomId('spec-v')
        }
      });
      return;
    }

    if (path.endsWith('/v1/asset-categories') && method === 'POST') {
      const body = parseJsonBody(request);
      const category = {
        id: randomId('cat'),
        name: String(body.name ?? 'Unnamed category')
      };
      catalogs.categories.push(category);
      await fulfillJson(route, {
        data: {
          category,
          versionId: randomId('spec-v')
        }
      });
      return;
    }

    if (path.endsWith('/v1/assets/catalogs/vendors') && method === 'POST') {
      const body = parseJsonBody(request);
      const vendor = {
        id: randomId('vendor'),
        name: String(body.name ?? 'Unnamed vendor'),
        taxCode: null,
        phone: null,
        email: null,
        address: null
      };
      catalogs.vendors.push(vendor);
      await fulfillJson(route, { data: vendor });
      return;
    }

    if (/\/v1\/assets\/catalogs\/categories\/[^/]+$/.test(path) && method === 'PUT') {
      const id = path.split('/').pop() ?? '';
      const body = parseJsonBody(request);
      const current = catalogs.categories.find((item) => item.id === id);
      const updated = {
        id,
        name: String(body.name ?? current?.name ?? 'Category')
      };
      catalogs.categories = catalogs.categories.map((item) => (item.id === id ? updated : item));
      await fulfillJson(route, { data: updated });
      return;
    }

    if (/\/v1\/assets\/catalogs\/categories\/[^/]+$/.test(path) && method === 'DELETE') {
      const id = path.split('/').pop() ?? '';
      catalogs.categories = catalogs.categories.filter((item) => item.id !== id);
      await fulfillJson(route, { data: { id } });
      return;
    }

    if (/\/v1\/assets\/catalogs\/vendors\/[^/]+$/.test(path) && method === 'PUT') {
      const id = path.split('/').pop() ?? '';
      const body = parseJsonBody(request);
      const current = catalogs.vendors.find((item) => item.id === id);
      const updated = {
        id,
        name: String(body.name ?? current?.name ?? 'Vendor'),
        taxCode: typeof body.taxCode === 'string' ? body.taxCode : current?.taxCode ?? null,
        phone: typeof body.phone === 'string' ? body.phone : current?.phone ?? null,
        email: typeof body.email === 'string' ? body.email : current?.email ?? null,
        address: typeof body.address === 'string' ? body.address : current?.address ?? null
      };
      catalogs.vendors = catalogs.vendors.map((item) => (item.id === id ? updated : item));
      await fulfillJson(route, { data: updated });
      return;
    }

    if (/\/v1\/assets\/catalogs\/vendors\/[^/]+$/.test(path) && method === 'DELETE') {
      const id = path.split('/').pop() ?? '';
      catalogs.vendors = catalogs.vendors.filter((item) => item.id !== id);
      await fulfillJson(route, { data: { id } });
      return;
    }

    if (/\/v1\/assets\/catalogs\/models\/[^/]+$/.test(path) && method === 'PUT') {
      const id = path.split('/').pop() ?? '';
      const body = parseJsonBody(request);
      const current = catalogs.models.find((item) => item.id === id);
      const updated = {
        id,
        model: String(body.model ?? current?.model ?? 'Model'),
        brand: typeof body.brand === 'string' ? body.brand : current?.brand ?? null,
        categoryId: typeof body.categoryId === 'string' ? body.categoryId : current?.categoryId ?? null,
        specVersionId: current?.specVersionId ?? null,
        vendorId: typeof body.vendorId === 'string' ? body.vendorId : current?.vendorId ?? null,
        spec: typeof body.spec === 'object' && body.spec !== null ? body.spec as Record<string, unknown> : current?.spec ?? {}
      };
      catalogs.models = catalogs.models.map((item) => (item.id === id ? updated : item));
      await fulfillJson(route, { data: updated });
      return;
    }

    if (/\/v1\/assets\/catalogs\/models\/[^/]+$/.test(path) && method === 'DELETE') {
      const id = path.split('/').pop() ?? '';
      catalogs.models = catalogs.models.filter((item) => item.id !== id);
      await fulfillJson(route, { data: { id } });
      return;
    }

    if (/\/v1\/assets\/catalogs\/locations\/[^/]+$/.test(path) && method === 'PUT') {
      const id = path.split('/').pop() ?? '';
      const body = parseJsonBody(request);
      const current = catalogs.locations.find((item) => item.id === id);
      const updated = {
        id,
        name: String(body.name ?? current?.name ?? 'Location'),
        parentId: typeof body.parentId === 'string' ? body.parentId : current?.parentId ?? null,
        path: current?.path ?? `/loc/${id}`
      };
      catalogs.locations = catalogs.locations.map((item) => (item.id === id ? updated : item));
      await fulfillJson(route, { data: updated });
      return;
    }

    if (/\/v1\/assets\/catalogs\/locations\/[^/]+$/.test(path) && method === 'DELETE') {
      const id = path.split('/').pop() ?? '';
      catalogs.locations = catalogs.locations.filter((item) => item.id !== id);
      await fulfillJson(route, { data: { id } });
      return;
    }

    if (path.endsWith('/v1/assets/catalogs/models') && method === 'POST') {
      const body = parseJsonBody(request);
      const model = {
        id: randomId('model'),
        model: String(body.model ?? 'Model'),
        brand: typeof body.brand === 'string' ? body.brand : null,
        categoryId: typeof body.categoryId === 'string' ? body.categoryId : null,
        specVersionId: null,
        vendorId: typeof body.vendorId === 'string' ? body.vendorId : null,
        spec: typeof body.spec === 'object' && body.spec !== null ? body.spec as Record<string, unknown> : {}
      };
      catalogs.models.push(model);
      await fulfillJson(route, { data: model });
      return;
    }

    if (path.endsWith('/v1/assets/catalogs/locations') && method === 'POST') {
      const body = parseJsonBody(request);
      const location = {
        id: randomId('loc'),
        name: String(body.name ?? 'Location'),
        parentId: typeof body.parentId === 'string' ? body.parentId : null,
        path: `/loc/${randomId('path')}`
      };
      catalogs.locations.push(location);
      await fulfillJson(route, { data: location });
      return;
    }

    if (/\/v1\/asset-categories\/[^/]+\/spec-defs$/.test(path) && method === 'GET') {
      await fulfillJson(route, { data: [] });
      return;
    }

    if (path.endsWith('/v1/asset-models') && method === 'GET') {
      const categoryId = url.searchParams.get('categoryId');
      const filtered = categoryId
        ? catalogs.models.filter((item) => item.categoryId === categoryId)
        : catalogs.models;
      await fulfillJson(route, { data: filtered, meta: { total: filtered.length, page: 1, limit: 20 } });
      return;
    }

    if (path.endsWith('/v1/assets/status-counts') && method === 'GET') {
      await fulfillJson(route, {
        data: {
          in_stock: 1,
          in_use: 0,
          in_repair: 0,
          retired: 0,
          disposed: 0,
          lost: 0
        }
      });
      return;
    }

    if (path.endsWith('/v1/assets') && method === 'GET') {
      const status = url.searchParams.get('status');
      const query = (url.searchParams.get('query') ?? '').toLowerCase();
      const byStatus = status ? assets.filter((item) => item.status === status) : assets;
      const filtered = query
        ? byStatus.filter((item) =>
          [
            item.assetCode,
            item.serialNo,
            item.hostname,
            item.mgmtIp,
            item.modelName,
            item.vendorName,
            item.locationName
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        )
        : byStatus;
      await fulfillJson(route, { data: filtered, meta: { total: filtered.length, page: 1, limit: 20 } });
      return;
    }

    if (path.endsWith('/v1/assets') && method === 'POST') {
      const body = parseJsonBody(request);
      const created = {
        id: randomId('asset'),
        assetCode: String(body.assetCode ?? 'ASSET-NEW'),
        status: String(body.status ?? 'in_stock'),
        modelId: typeof body.modelId === 'string' ? body.modelId : null,
        categoryId: null,
        vendorId: typeof body.vendorId === 'string' ? body.vendorId : null,
        locationId: typeof body.locationId === 'string' ? body.locationId : null,
        serialNo: null,
        macAddress: null,
        mgmtIp: null,
        hostname: null,
        vlanId: null,
        switchName: null,
        switchPort: null,
        purchaseDate: null,
        warrantyEnd: null,
        notes: null,
        modelName: null,
        modelBrand: null,
        categoryName: null,
        vendorName: null,
        locationName: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      assets.unshift(created as any);
      await fulfillJson(route, { data: created });
      return;
    }

    if (/\/v1\/assets\/[^/]+$/.test(path) && method === 'PUT') {
      await fulfillJson(route, { data: assets[0] });
      return;
    }

    if (/\/v1\/assets\/[^/]+$/.test(path) && method === 'DELETE') {
      const id = path.split('/').pop() ?? '';
      const index = assets.findIndex((item) => item.id === id);
      if (index >= 0) {
        assets.splice(index, 1);
      }
      await fulfillJson(route, { data: { id } });
      return;
    }

    if (/\/v1\/maintenance\/[^/]+\/status$/.test(path) && method === 'PUT') {
      const id = path.split('/')[path.split('/').length - 2] ?? '';
      const body = parseJsonBody(request);
      await fulfillJson(route, {
        data: {
          id,
          assetId: 'asset-001',
          title: 'Maintenance',
          severity: 'low',
          status: typeof body.status === 'string' ? body.status : 'open',
          openedAt: new Date().toISOString(),
          diagnosis: typeof body.diagnosis === 'string' ? body.diagnosis : null,
          resolution: typeof body.resolution === 'string' ? body.resolution : null,
          createdBy: user.id
        }
      });
      return;
    }

    if (/\/v1\/maintenance\/[^/]+$/.test(path) && method === 'DELETE') {
      const id = path.split('/').pop() ?? '';
      await fulfillJson(route, {
        data: {
          id,
          assetId: 'asset-001',
          title: 'Maintenance',
          severity: 'low',
          status: 'canceled',
          openedAt: new Date().toISOString(),
          createdBy: user.id
        }
      });
      return;
    }

    if (/\/v1\/workflows\/[^/]+$/.test(path) && method === 'DELETE') {
      const id = path.split('/').pop() ?? '';
      await fulfillJson(route, {
        data: {
          id,
          requestType: 'assign',
          assetId: 'asset-001',
          status: 'canceled',
          requestedBy: user.id,
          approvedBy: user.id,
          payload: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
      return;
    }

    if (/\/v1\/assets\/[^/]+\/move$/.test(path) && method === 'POST') {
      await fulfillJson(route, { data: assets[0] });
      return;
    }

    if (path.endsWith('/v1/cmdb/types') && method === 'GET') {
      await fulfillJson(route, { data: [] });
      return;
    }

    if (path.endsWith('/v1/cmdb/cis') && method === 'GET') {
      await fulfillJson(route, { data: [], meta: { total: 0, page: 1, limit: 20 } });
      return;
    }

    if (path.endsWith('/v1/cmdb/relationship-types') && method === 'GET') {
      await fulfillJson(route, { data: [] });
      return;
    }

    if (path.endsWith('/v1/cmdb/services') && method === 'GET') {
      await fulfillJson(route, { data: [], meta: { total: 0, page: 1, limit: 20 } });
      return;
    }

    if (path.endsWith('/v1/cmdb/graph') && method === 'GET') {
      await fulfillJson(route, { data: { nodes: [], edges: [] } });
      return;
    }

    if (path.endsWith('/v1/warehouses') && method === 'GET') {
      await fulfillJson(route, { data: warehouses });
      return;
    }

    if (path.endsWith('/v1/stock/view') && method === 'GET') {
      await fulfillJson(route, { data: stockView, meta: { total: stockView.length, page: 1, limit: 20 } });
      return;
    }

    if (path.startsWith('/v1/reports/') && method === 'GET') {
      if (path.endsWith('/valuation')) {
        await fulfillJson(route, { data: { total: 0, currency: 'VND', items: [] } });
      } else {
        await fulfillJson(route, { data: [] });
      }
      return;
    }

    const genericData = method === 'GET' ? [] : {};
    await fulfillJson(route, { data: genericData, meta: { total: 0, page: 1, limit: 20 } });
  });
}
