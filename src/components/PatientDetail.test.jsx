import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import PatientDetail from './PatientDetail'
import { resourceApi } from '../api/resources'

const patient={id_paciente:7,tipo_documento:'CC',numero_documento:'12345',nombres:'Ana',apellidos:'Prueba'}
const record={
  patient:{...patient,grupo_sanguineo:'O+'},
  history:{numero_historia:'HC-7',estado:'activa',fecha_apertura:'2026-01-02'},
  consultations:[{id_consulta:11,fecha_hora:'2026-01-02T10:00:00',tipo_consulta:'control',medico_nombres:'Luis',medico_apellidos:'Médico',estado:'finalizada',motivo_consulta:'Control anual'}],
  diagnoses:[{id_consulta:11,id_diagnostico:3,codigo_cie10:'J00',nombre:'Diagnóstico de prueba',tipo:'principal'}],
  vitals:[{id_signos:2,medido_en:'2026-01-02T10:00:00',presion_sistolica:120}],
  prescriptions:[{id_receta:4,id_consulta:11,fecha_emision:'2026-01-02T10:00:00',indicaciones_generales:'Con alimentos'}],
  prescriptionItems:[{id_receta_detalle:5,id_receta:4,id_consulta:11,medicamento_nombre:'Medicamento de prueba',dosis:'1 tableta'}],
  orders:[{id_orden:8,id_consulta:11,fecha_emision:'2026-01-02T10:00:00',observaciones:'Rutina'}],
  orderItems:[{id_orden_detalle:9,id_orden:8,id_consulta:11,examen_nombre:'Hemograma',estado:'solicitado'}],
  allergies:[{id_paciente_alergia:10,nombre:'Polen',tipo:'ambiental',severidad:'leve'}],
  background:[{id_paciente_antecedente:12,nombre:'Asma',tipo:'personal'}],
}

afterEach(()=>{cleanup();vi.restoreAllMocks()})

function renderChart(user){
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}})
  return render(<QueryClientProvider client={client}><MemoryRouter><PatientDetail patient={patient} user={user} onClose={()=>{}}/></MemoryRouter></QueryClientProvider>)
}

describe('ficha clínica del paciente',()=>{
  it('muestra los datos devueltos por la API en sus secciones clínicas',async()=>{
    vi.spyOn(resourceApi,'patientRecord').mockResolvedValue(record)
    renderChart()
    expect(await screen.findByText('Historia HC-7')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab',{name:'Diagnósticos'}))
    expect(await screen.findByText('Diagnóstico de prueba')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab',{name:'Alergias'}))
    expect(await screen.findByText('Polen')).toBeTruthy()
  })

  it('prepara todas las secciones de la ficha antes de imprimir',async()=>{
    vi.spyOn(resourceApi,'patientRecord').mockResolvedValue(record)
    vi.spyOn(resourceApi,'registerPatientExport').mockResolvedValue({registered:true})
    const print=vi.spyOn(window,'print').mockImplementation(()=>{})
    renderChart()
    await screen.findByText('Historia HC-7')
    fireEvent.click(screen.getByRole('button',{name:/Imprimir ficha/}))
    await waitFor(()=>expect(print).toHaveBeenCalled())
    expect(screen.getByText('Diagnóstico de prueba')).toBeTruthy()
    expect(screen.getByText('Hemograma')).toBeTruthy()
    fireEvent(window,new Event('afterprint'))
  })

  it('resalta las alergias graves al abrir la ficha',async()=>{
    vi.spyOn(resourceApi,'patientRecord').mockResolvedValue({...record,allergies:[{id_paciente_alergia:13,nombre:'Penicilina',severidad:'grave'}]})
    renderChart()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Penicilina')).toBeTruthy()
  })

  it('muestra la auditoría de la historia solo a administradores',async()=>{
    vi.spyOn(resourceApi,'patientRecord').mockResolvedValue({...record,audit:[{id_auditoria:1,fecha_hora:'2026-01-02T10:00:00',nombres:'Admin',apellidos:'Clínica',accion:'consulta',entidad:'pacientes',id_registro:7,ip_origen:'127.0.0.1'}]})
    renderChart({roles:['Administrador']})
    await screen.findByText('Historia HC-7')
    fireEvent.click(screen.getByRole('tab',{name:'Auditoría'}))
    expect(screen.getByText('Clínica')).toBeTruthy()
    cleanup()
    vi.restoreAllMocks()
    vi.spyOn(resourceApi,'patientRecord').mockResolvedValue(record)
    renderChart({roles:['Médico']})
    await screen.findByText('Historia HC-7')
    expect(screen.queryByRole('tab',{name:'Auditoría'})).toBeNull()
  })
})
