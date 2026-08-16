import { apiGet, apiPut } from './client.js'

export function listChargeTargetTypes() {
  return apiGet('/maintenance/charge-target-types')
}

export function setChargeTargetTypeEnablement(chargeTargetTypeId, isEnabled) {
  return apiPut(`/maintenance/charge-target-types/${chargeTargetTypeId}/enablement`, { isEnabled })
}
