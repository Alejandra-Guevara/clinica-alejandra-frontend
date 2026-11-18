import { expect, test } from '@playwright/test'

const patient={id_paciente:7,tipo_documento:'CC',numero_documento:'12345',nombres:'Ana',apellidos:'Prueba'}
const record={
  patient:{...patient,grupo_sanguineo:'O+'},history:{numero_historia:'HC-7',estado:'activa',fecha_apertura:'2026-01-02'},
  consultations:[],diagnoses:[],vitals:[],prescriptions:[],prescriptionItems:[],orders:[],orderItems:[],
  allergies:[{id_paciente_alergia:10,nombre:'Penicilina',tipo:'medicamento',severidad:'grave',reaccion:'Anafilaxia'}],
  background:[],audit:[{id_auditoria:1,id_usuario:2,nombres:'Administradora',apellidos:'ClÃ­nica',accion:'consulta',entidad:'pacientes',id_registro:7,fecha_hora:'2026-01-02T10:00:00',ip_origen:'127.0.0.1'}],
}

async function mockBackend(page,role='Administrador') {
  const calls=[]
  let authenticated=false
  await page.route('http://localhost:3000/api/**',async(route)=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname.replace('/api',''),method=request.method()
    calls.push({path,method,query:Object.fromEntries(url.searchParams.entries()),body:request.postDataJSON()})
    const json=async(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
    if(path==='/auth/me') return authenticated
      ? json({data:{user:{id_usuario:2,nombres:'Alejandra',apellidos:'ClÃ­nica',email:'admin@clinica.test',roles:[role]}}})
      : json({error:{code:'UNAUTHENTICATED',message:'Inicia sesiÃ³n'}},401)
    if(path==='/auth/csrf') return json({data:{token:'test-csrf-token'}})
    if(path==='/auth/login'&&method==='POST') { authenticated=true; return json({data:{user:{id_usuario:2,nombres:'Alejandra',apellidos:'ClÃ­nica',email:'admin@clinica.test',roles:[role]}}}) }
    if(path==='/dashboard') return json({data:{totalPacientes:1,medicosActivos:1,totalConsultas:0,consultasHoy:0,consultasPorEstado:[],consultasPorPeriodo:[],consultasRecientes:[]}})
    if(path==='/pacientes/portal/me') return json({data:{patient}})
    if(path==='/pacientes'&&method==='GET') return json({data:[{...patient,fecha_nacimiento:'1990-01-01'}],meta:{page:1,limit:10,total:1}})
    if(path==='/pacientes'&&method==='POST') return json({data:{id:8}},201)
    if(path==='/pacientes/7'&&method==='PUT') return json({data:{updated:true}})
    if(path==='/pacientes/7/record') return json({data:record})
    if(path==='/pacientes/7/record/export'&&method==='POST') return json({data:{registered:true}})
    if(path==='/historias-clinicas'&&method==='GET') return json({data:[{id_historia:9,id_paciente:7,numero_historia:'HC-7',estado:'activa'}],meta:{page:1,limit:100,total:1}})
    if(path==='/medicos'&&method==='GET') return json({data:[{id_medico:3,nombres:'Dra. Luz',apellidos:'MÃ©dica',numero_registro_profesional:'RM-3',activo:1}],meta:{page:1,limit:100,total:1}})
    if(path==='/asignaciones-historia'&&method==='GET') return json({data:[],meta:{page:1,limit:10,total:0}})
    if(path==='/asignaciones-historia'&&method==='POST') return json({data:{id:11}} ,201)
    if(path==='/usuarios'&&method==='GET') return json({data:[{id_usuario:2,nombres:'Alejandra',apellidos:'Clinica',email:'admin@clinica.test',estado:'activo',roles:'Administrador'}],meta:{page:1,limit:10,total:1}})
    if(path==='/usuarios'&&method==='POST') return json({data:{id:12}},201)
    if(path==='/usuarios/2'&&method==='PUT') return json({data:{updated:true}})
    if(path==='/roles'&&method==='GET') return json({data:[{id_rol:1,nombre:'Administrador'},{id_rol:2,nombre:'MÃ©dico'},{id_rol:3,nombre:'Paciente'}]})
    return json({data:[]})
  })
  return calls
}

async function signIn(page,role='Administrador') {
  await page.goto('/login')
  await page.getByPlaceholder('nombre@clinica.com').fill('admin@clinica.test')
  await page.getByPlaceholder('Tu contraseña').fill('test-password-123')
  await page.locator('.login-submit').click()
  if(role==='Paciente') await expect(page.getByRole('heading',{name:/Mi historia de salud/})).toBeVisible()
  else await expect(page.getByRole('link',{name:'Pacientes'})).toBeVisible()
}

test('login permite abrir la ficha del paciente y consultar alergia y auditorÃ­a autorizada',async({page})=>{
  const calls=await mockBackend(page)
  await signIn(page)
  await page.getByRole('link',{name:'Pacientes'}).click()
  await expect(page.getByRole('heading',{name:'Pacientes'})).toBeVisible()
  await page.getByRole('button',{name:'Ordenar por Documento'}).click()
  await expect.poll(()=>calls.some((call)=>call.path==='/pacientes'&&call.query.sort==='numero_documento')).toBeTruthy()
  await page.getByRole('button',{name:'Ver detalle'}).click()
  await expect(page.getByRole('heading',{name:'Ana Prueba'}).last()).toBeVisible()
  await page.evaluate(()=>{window.print=()=>{}})
  await page.getByRole('button',{name:'Imprimir ficha'}).click()
  await expect.poll(()=>calls.some((call)=>call.path==='/pacientes/7/record/export'&&call.method==='POST')).toBeTruthy()
  await page.getByRole('tab',{name:'Alergias'}).click()
  await expect(page.getByRole('alert')).toContainText('Penicilina')
  await page.getByRole('tab',{name:/Auditor/}).click()
  await expect(page.getByText('Administradora')).toBeVisible()
  await page.getByRole('button',{name:'Cerrar ficha'}).click()
  await page.getByRole('button',{name:/Cerrar sesi/}).click()
  await expect(page.getByPlaceholder('nombre@clinica.com')).toBeVisible()
})

test('la interfaz deniega el mÃ³dulo de asignaciones a un mÃ©dico',async({page})=>{
  await mockBackend(page,'MÃ©dico')
  await signIn(page)
  await page.goto('/asignaciones-historia')
  await expect(page.getByRole('heading',{name:/No tienes acceso a esta secci/})).toBeVisible()
  await expect(page.getByRole('link',{name:/Asignar m/})).toHaveCount(0)
})

test('el paciente autenticado accede a su portal y no a los mÃ³dulos administrativos',async({page})=>{
  await mockBackend(page,'Paciente')
  await signIn(page,'Paciente')
  await expect(page.getByRole('button',{name:/Ver mi historia cl/})).toBeVisible()
  await expect(page.getByRole('link',{name:'Pacientes'})).toHaveCount(0)
  await page.getByRole('button',{name:/Ver mi historia cl/}).click()
  await expect(page.getByRole('heading',{name:'Ana Prueba'}).last()).toBeVisible()
  await page.goto('/pacientes')
  await expect(page.getByRole('heading',{name:/No tienes acceso a esta secci/})).toBeVisible()
})

test('el inicio ya no ofrece rutas para recuperar contrasenas',async({page})=>{
  await mockBackend(page)
  await signIn(page)
  await expect(page.getByRole('link',{name:/recuperar acceso/i})).toHaveCount(0)
  await page.goto('/recuperar-contrasena')
  await expect(page.getByRole('heading',{name:/No encontramos esa p/})).toBeVisible()
  await page.goto('/restablecer-contrasena?token=invalid')
  await expect(page.getByRole('heading',{name:/No encontramos esa p/})).toBeVisible()
})

test('el formulario de asignaciÃ³n envÃ­a los vÃ­nculos elegidos al endpoint real de API',async({page})=>{
  const calls=await mockBackend(page)
  await signIn(page)
  await page.getByRole('link',{name:/Asignar m/}).click()
  await expect(page.getByRole('heading',{name:/Asignaciones de m/})).toBeVisible()
  await page.getByLabel('Filtrar por Estado').selectOption('inactiva')
  await expect.poll(()=>calls.some((call)=>call.path==='/asignaciones-historia'&&call.query.estado==='inactiva')).toBeTruthy()
  await page.getByRole('button',{name:/Nuevo v/}).click()
  await page.locator('[name="id_historia"]').selectOption('9')
  await page.locator('[name="id_medico"]').selectOption('3')
  await page.getByRole('button',{name:'Guardar registro'}).click()
  await expect.poll(()=>calls.find((call)=>call.path==='/asignaciones-historia'&&call.method==='POST')?.body).toEqual({id_historia:9,id_medico:3})
})

test('la administracion de usuarios busca con paginacion del servidor',async({page})=>{
  const calls=await mockBackend(page)
  await signIn(page)
  await page.getByRole('link',{name:'Usuarios'}).click()
  await expect(page.getByRole('heading',{name:'Usuarios'})).toBeVisible()
  await page.getByLabel('Buscar usuarios').fill('admin@clinica.test')
  await expect.poll(()=>calls.some((call)=>call.path==='/usuarios'&&call.query.search==='admin@clinica.test')).toBeTruthy()
  await page.getByRole('button',{name:'Editar'}).click()
  await page.locator('[name="nombres"]').fill('Alejandra Actualizada')
  await page.getByRole('button',{name:'Guardar usuario'}).click()
  await expect.poll(()=>calls.some((call)=>call.path==='/usuarios/2'&&call.method==='PUT'&&call.body.nombres==='Alejandra Actualizada')).toBeTruthy()
  await page.getByRole('button',{name:'Crear usuario'}).click()
  await page.locator('[name="nombres"]').fill('Paciente Nuevo')
  await page.locator('[name="apellidos"]').fill('Prueba')
  await page.locator('[name="email"]').fill('paciente.nuevo@clinica.test')
  await page.locator('[name="password"]').fill('Initial-Secure-Password-2026')
  await page.locator('[name="roles"]').selectOption(['Paciente'])
  await page.getByRole('button',{name:'Guardar usuario'}).click()
  await expect.poll(()=>calls.some((call)=>call.path==='/usuarios'&&call.method==='POST'&&call.body.email==='paciente.nuevo@clinica.test')).toBeTruthy()
  expect(calls.find((call)=>call.path==='/usuarios'&&call.method==='POST')?.body.estado).toBeUndefined()
})

test('la interfaz registra y actualiza pacientes mediante la API',async({page})=>{
  const calls=await mockBackend(page)
  await signIn(page)
  await page.getByRole('link',{name:'Pacientes'}).click()
  await expect(page.getByRole('heading',{name:'Pacientes'})).toBeVisible()
  await page.getByRole('button',{name:'Nuevo paciente'}).click()
  await page.locator('[name="tipo_documento"]').fill('CC')
  await page.locator('[name="numero_documento"]').fill('998877')
  await page.locator('[name="nombres"]').fill('Laura')
  await page.locator('[name="apellidos"]').fill('Nueva')
  await page.locator('[name="fecha_nacimiento"]').fill('1992-04-03')
  await page.getByRole('button',{name:'Guardar registro'}).click()
  await expect.poll(()=>calls.some((call)=>call.path==='/pacientes'&&call.method==='POST'&&call.body.numero_documento==='998877')).toBeTruthy()
  await page.getByRole('button',{name:'Editar'}).click()
  await page.locator('[name="telefono"]').fill('3001112233')
  await page.getByRole('button',{name:'Guardar registro'}).click()
  await expect.poll(()=>calls.some((call)=>call.path==='/pacientes/7'&&call.method==='PUT'&&call.body.telefono==='3001112233')).toBeTruthy()
})


test('contextual patient search finds a patient and opens the filtered list',async({page})=>{
  const calls=await mockBackend(page)
  await signIn(page)
  const search=page.getByRole('textbox',{name:'Buscar pacientes'})
  await search.fill('123')
  await expect.poll(()=>calls.some((call)=>call.path==='/pacientes'&&call.method==='GET'&&call.query.search==='123'&&call.query.audit==='true')).toBeTruthy()
  await expect(page.getByRole('option',{name:/Ana Prueba/})).toBeVisible()
  await page.getByRole('option',{name:/Ana Prueba/}).click()
  await expect(page.getByRole('heading',{name:'Pacientes'})).toBeVisible()
  await expect(page.getByRole('textbox',{name:'Buscar',exact:true})).toHaveValue('12345')
})

