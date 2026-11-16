import api, { getData } from './client'

export const resourceApi = {
  list: (key, params = {}) => getData(api.get(`/${key}`, { params })).then((r) => r),
  get: (key, id) => getData(api.get(`/${key}/${id}`)).then((r) => r.data),
  create: (key, data) => getData(api.post(`/${key}`, data)).then((r) => r.data),
  update: (key, id, data) => getData(api.put(`/${key}/${id}`, data)).then((r) => r.data),
  dashboard: () => getData(api.get('/dashboard')).then((r) => r.data),
  patientRecord: (id) => getData(api.get(`/pacientes/${id}/record`)).then((r) => r.data),
  registerPatientExport: (id) => getData(api.post(`/pacientes/${id}/record/export`)).then((r) => r.data),
}
