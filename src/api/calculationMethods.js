import { apiGet } from './client.js'

export function listCalculationMethods() {
  return apiGet('/maintenance/calculation-methods')
}
