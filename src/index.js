require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Função para calcular distância Haversine em metros
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Função para mascarar CPF
function maskCpf(cpf) {
  if (!cpf) return '';
  return '***.***.***-**';
}

// Função para salvar foto base64 como arquivo PNG
function savePhoto(photoBase64, filePath) {
  if (!photoBase64) return;
  const base64Data = photoBase64.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(filePath, base64Data, 'base64');
}

// Função para fazer requisições GET
async function getRequest(url) {
  const token = process.env.NEXTI_TOKEN;
  if (!token) {
    throw new Error('NEXTI_TOKEN não definido no .env');
  }
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 401) {
        throw new Error('Token ausente, expirado ou não autorizado.');
      } else if (error.response.status === 409) {
        throw new Error('Intervalo de datas inválido. A API da Nexti pode limitar a no máximo 1 dia.');
      } else {
        throw new Error(`Erro na API: ${error.response.status} - ${error.response.data}`);
      }
    } else {
      throw error;
    }
  }
}

// Função principal
async function main() {
  const baseUrl = process.env.NEXTI_BASE_URL || 'https://api.nexti.com';
  const testStart = process.env.TEST_START;
  const testFinish = process.env.TEST_FINISH;
  const allowedDistance = parseInt(process.env.ALLOWED_DISTANCE_METERS) || 300;

  console.log('Iniciando teste da API Nexti...');

  // Criar diretório para fotos
  const photosDir = path.join(__dirname, '..', 'output', 'photos');
  if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
  }

  // 1. Buscar pessoas
  console.log('Buscando pessoas...');
  const personsUrl = `${baseUrl}/persons/all?page=0&size=100`;
  const personsData = await getRequest(personsUrl);
  const persons = personsData.content || personsData; // Ajustar se necessário

  console.log(`Total de pessoas carregadas: ${persons.length}`);

  // Listar cargos únicos
  const uniqueCareers = [...new Set(persons.map(p => p.nameCareer).filter(c => c))];
  console.log(`Total de cargos únicos encontrados: ${uniqueCareers.length}`);
  console.log('Cargos únicos:', uniqueCareers);

  // Filtrar bombeiros
  const firefighterKeywords = ['BOMBEIRO', 'BOMB', 'BOMBEIRO CIVIL', 'BOMBEIRO CONDUTOR', 'B.C.'];
  const firefighters = persons.filter(p =>
    p.nameCareer && firefighterKeywords.some(kw => p.nameCareer.toUpperCase().includes(kw.toUpperCase()))
  );
  console.log(`Total de bombeiros encontrados: ${firefighters.length}`);

  // Salvar bombeiros.json
  const bombeirosData = firefighters.map(p => ({
    personId: p.id,
    name: p.name,
    enrolment: p.enrolment,
    nameCareer: p.nameCareer,
    workplaceId: p.workplaceId,
    workplaceName: p.workplaceName,
    externalWorkplaceId: p.externalWorkplaceId,
    allowMobileClocking: p.allowMobileClocking,
    cpfMasked: maskCpf(p.cpf)
  }));
  fs.writeFileSync(path.join(__dirname, '..', 'output', 'bombeiros.json'), JSON.stringify(bombeirosData, null, 2));

  // 2. Buscar marcações
  console.log('Buscando marcações...');
  let clockings = [];
  try {
    const clockingsUrl = `${baseUrl}/clockings/start/${testStart}/finish/${testFinish}`;
    const clockingsData = await getRequest(clockingsUrl);
    clockings = clockingsData.content || clockingsData;
  } catch (error) {
    console.log('Erro no endpoint principal, tentando lastupdate...');
    try {
      const clockingsUrl = `${baseUrl}/clockings/lastupdate/start/${testStart}/finish/${testFinish}/types?page=0&size=100`;
      const clockingsData = await getRequest(clockingsUrl);
      clockings = clockingsData.content || clockingsData;
    } catch (error2) {
      console.error('Falha ao buscar marcações:', error2.message);
      clockings = [];
    }
  }

  console.log(`Total de marcações no período: ${clockings.length}`);

  // Salvar clockings_raw_sanitized.json e fotos
  const clockingsSanitized = clockings.map(c => {
    let photoPath = null;
    if (c.photo) {
      photoPath = `photos/${c.id}.png`;
      savePhoto(c.photo, path.join(photosDir, `${c.id}.png`));
    }
    return {
      id: c.id,
      personId: c.personId,
      personName: c.personName,
      workplaceId: c.workplaceId,
      externalWorkplaceId: c.externalWorkplaceId,
      clockingDate: c.clockingDate,
      referenceDate: c.referenceDate,
      latitude: c.latitude,
      longitude: c.longitude,
      photoPath,
      deviceDescription: c.deviceDescription,
      clockingTypeName: c.clockingTypeName,
      lastUpdate: c.lastUpdate,
      online: c.online,
      personCpfMasked: maskCpf(c.personCpf)
    };
  });
  fs.writeFileSync(path.join(__dirname, '..', 'output', 'clockings_raw_sanitized.json'), JSON.stringify(clockingsSanitized, null, 2));

  // Filtrar marcações de bombeiros
  const firefighterIds = new Set(firefighters.map(f => f.id));
  const clockingsBombeiros = clockings.filter(c => firefighterIds.has(c.personId));
  console.log(`Total de marcações de bombeiros: ${clockingsBombeiros.length}`);

  // Salvar clockings_bombeiros.json
  fs.writeFileSync(path.join(__dirname, '..', 'output', 'clockings_bombeiros.json'), JSON.stringify(clockingsBombeiros, null, 2));

  // 3. Buscar postos
  let workplaces = [];
  try {
    const workplacesUrl = `${baseUrl}/workplaces/all`;
    const workplacesData = await getRequest(workplacesUrl);
    workplaces = workplacesData.content || workplacesData;
  } catch (error) {
    console.log('Falha ao buscar postos:', error.message);
    console.log('Continuando sem cálculo de distância.');
  }

  // Salvar workplaces_sanitized.json
  const workplacesSanitized = workplaces.map(w => ({
    id: w.id,
    name: w.name,
    clientName: w.clientName,
    latitude: w.latitude,
    longitude: w.longitude,
    maximumPerimeterRecordMarking: w.maximumPerimeterRecordMarking,
    active: w.active
  }));
  fs.writeFileSync(path.join(__dirname, '..', 'output', 'workplaces_sanitized.json'), JSON.stringify(workplacesSanitized, null, 2));

  // 4. Gerar alertas
  const alerts = [];
  const workplaceMap = new Map(workplaces.map(w => [w.id, w]));

  for (const clocking of clockingsBombeiros) {
    const person = firefighters.find(f => f.id === clocking.personId);
    const workplace = workplaceMap.get(clocking.workplaceId);

    let status = 'NORMAL';
    let severity = 'BAIXA';
    let reason = '';

    if (!clocking.latitude || !clocking.longitude) {
      status = 'SEM_LOCALIZACAO';
      severity = 'MEDIA';
      reason = 'Marcação sem coordenadas GPS';
    } else if (!workplace || !workplace.latitude || !workplace.longitude) {
      status = 'POSTO_SEM_COORDENADA';
      severity = 'MEDIA';
      reason = 'Posto sem coordenadas definidas';
    } else {
      const distance = haversineDistance(clocking.latitude, clocking.longitude, workplace.latitude, workplace.longitude);
      const allowedRadius = workplace.maximumPerimeterRecordMarking || allowedDistance;

      if (distance <= allowedRadius) {
        status = 'NORMAL';
        severity = 'BAIXA';
      } else if (distance <= 500) {
        status = 'ATENCAO_FORA_PERIMETRO';
        severity = 'MEDIA';
      } else if (distance <= 1000) {
        status = 'FORA_DA_UNIDADE';
        severity = 'ALTA';
      } else {
        status = 'CRITICO_FORA_DA_UNIDADE';
        severity = 'CRITICA';
      }
      reason = `Distância: ${distance.toFixed(2)}m, Permitido: ${allowedRadius}m`;
    }

    alerts.push({
      status,
      severity,
      personId: clocking.personId,
      personName: clocking.personName,
      nameCareer: person ? person.nameCareer : '',
      workplaceId: clocking.workplaceId,
      workplaceName: workplace ? workplace.name : '',
      clockingDate: clocking.clockingDate,
      clockingTypeName: clocking.clockingTypeName,
      clockingLatitude: clocking.latitude,
      clockingLongitude: clocking.longitude,
      workplaceLatitude: workplace ? workplace.latitude : null,
      workplaceLongitude: workplace ? workplace.longitude : null,
      distanceMeters: (clocking.latitude && clocking.longitude && workplace && workplace.latitude && workplace.longitude) ?
        haversineDistance(clocking.latitude, clocking.longitude, workplace.latitude, workplace.longitude) : null,
      allowedRadiusMeters: workplace ? (workplace.maximumPerimeterRecordMarking || allowedDistance) : allowedDistance,
      photoPath: clocking.photo ? `photos/${clocking.id}.png` : null,
      deviceDescription: clocking.deviceDescription,
      reason
    });
  }

  // Salvar alertas
  fs.writeFileSync(path.join(__dirname, '..', 'output', 'alertas_fora_unidade.json'), JSON.stringify(alerts, null, 2));

  // Resumo
  const totalAlertas = alerts.length;
  const semLocalizacao = alerts.filter(a => a.status === 'SEM_LOCALIZACAO').length;
  const comFoto = alerts.filter(a => a.photoPath).length;
  const semFoto = totalAlertas - comFoto;

  console.log(`Total de alertas fora da unidade: ${totalAlertas}`);
  console.log(`Total sem localização: ${semLocalizacao}`);
  console.log(`Total com foto: ${comFoto}`);
  console.log(`Total sem foto: ${semFoto}`);

  console.log('Teste concluído. Verifique os arquivos em output/');
}

// Executar
main().catch(console.error);