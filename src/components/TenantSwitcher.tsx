"use client";

import React from 'react';
import { useTenant } from '@/contexts/TenantContext';

export function TenantSwitcher() {
  const { activeTenantId, availableTenants, isMultiTenant, switchTenant } = useTenant();

  if (!isMultiTenant || availableTenants.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="tenant-select" className="text-xs font-semibold text-support-grey">
        Empresa:
      </label>
      <select
        id="tenant-select"
        value={activeTenantId}
        onChange={(e) => switchTenant(e.target.value)}
        className="text-sm border border-gray-300 rounded-md py-1.5 px-3 bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition cursor-pointer font-medium"
      >
        {availableTenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.nome_negocio}
          </option>
        ))}
      </select>
    </div>
  );
}
