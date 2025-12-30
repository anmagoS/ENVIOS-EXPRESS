// Configuración global
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzw43jHhDfngxhvc7HnCqP2BNEDpcUdwx3B-7I3W8uIbFYKMw9deMbzBtwgrFgbE7Mz/exec";
const REMITENTES_URL = "https://script.google.com/macros/s/AKfycbzw43jHhDfngxhvc7HnCqP2BNEDpcUdwx3B-7I3W8uIbFYKMw9deMbzBtwgrFgbE7Mz/exec?action=getRemitentes";
// Variables globales
let barriosData = [];
let remitentesData = [];
let currentFocus = -1;
let filteredBarrios = [];

// Elementos del DOM
let formaPagoInput, valorRecaudarInput, autoRecaudoLabel, valorRecaudarHelp;
let paymentOptions, barrioInput, barrioIdInput, autocompleteDropdown;
let remitenteInput, remitenteDropdown;
let resumenFormaPago, resumenValorRecaudar, resumenEstado;
let submitButton, submitText, submitIcon;

// ============================================
// FUNCIÓN PRINCIPAL DE INICIALIZACIÓN
// ============================================

function initApp() {
    console.log('🚀 Inicializando aplicación...');
    
    // Inicializar elementos del DOM
    initializeDOMElements();
    
    // Cargar datos
    loadBarriosData();
    loadRemitentesData();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Inicializar UI
    initializeUI();
    
    console.log('✅ Aplicación inicializada');
}

// ============================================
// FUNCIONES DE INICIALIZACIÓN DEL DOM
// ============================================

function initializeDOMElements() {
    console.log('🔍 Inicializando elementos DOM...');
    
    formaPagoInput = document.getElementById('formaPago');
    valorRecaudarInput = document.getElementById('valorRecaudar');
    autoRecaudoLabel = document.getElementById('autoRecaudoLabel');
    valorRecaudarHelp = document.getElementById('valorRecaudarHelp');
    paymentOptions = document.querySelectorAll('.payment-option');
    barrioInput = document.getElementById('barrioLocalidad');
    barrioIdInput = document.getElementById('barrioId');
    autocompleteDropdown = document.getElementById('autocompleteDropdown');
    resumenFormaPago = document.getElementById('resumenFormaPago');
    resumenValorRecaudar = document.getElementById('resumenValorRecaudar');
    resumenEstado = document.getElementById('resumenEstado');
    submitButton = document.getElementById('submitButton');
    submitText = document.getElementById('submitText');
    submitIcon = document.getElementById('submitIcon');
    
    // NUEVOS: Elementos para autocomplete de remitente
    remitenteInput = document.getElementById('remitente');
    remitenteDropdown = document.getElementById('remitenteAutocomplete');
    
    // DEBUG: Verificar que los elementos existen
    console.log('📍 Campo remitente:', remitenteInput ? '✅ Encontrado' : '❌ No encontrado');
    console.log('📍 Dropdown remitente:', remitenteDropdown ? '✅ Encontrado' : '❌ No encontrado');
}

// ============================================
// FUNCIONES PARA CARGA DE DATOS
// ============================================

function loadBarriosData() {
    console.log('📂 Cargando datos de barrios...');
    
    fetch('barrios.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            barriosData = data;
            console.log(`✅ Cargados ${barriosData.length} barrios`);
        })
        .catch(error => {
            console.error('❌ Error cargando barrios:', error);
            barriosData = getDefaultBarrios();
            console.log('⚠️ Usando datos de ejemplo como fallback');
        });
}

function loadRemitentesData() {
    console.log('📂 Cargando datos de remitentes desde:', REMITENTES_URL);
    
    fetch(REMITENTES_URL)
        .then(response => {
            console.log('📡 Respuesta de remitentes - Status:', response.status);
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            remitentesData = data;
            console.log(`✅ Cargados ${remitentesData.length} remitentes`);
            
            // Mostrar primeros 3 para debug
            if (remitentesData.length > 0) {
                console.log('📋 Primeros 3 remitentes:');
                for (let i = 0; i < Math.min(3, remitentesData.length); i++) {
                    console.log(`  ${i+1}. ${remitentesData[i].nombre} - Tel: ${remitentesData[i].telefono || 'Sin teléfono'}`);
                }
            }
        })
        .catch(error => {
            console.error('❌ Error cargando remitentes:', error);
            remitentesData = [];
        });
}

// ============================================
// FUNCIONES PARA AUTOCOMPLETE DE REMITENTES
// ============================================

function handleRemitenteInput() {
    const searchText = this.value.trim();
    console.log(`🔍 Buscando remitente: "${searchText}"`);
    
    if (searchText.length < 2) {
        remitenteDropdown.style.display = 'none';
        return;
    }
    
    const filteredRemitentes = filterRemitentes(searchText);
    console.log(`✅ Encontrados ${filteredRemitentes.length} coincidencias`);
    showRemitenteAutocomplete(filteredRemitentes);
}

function handleRemitenteKeydown(e) {
    if (remitenteDropdown.style.display === 'block') {
        const items = remitenteDropdown.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            handleAutocompleteNavigation(e, items, remitenteDropdown);
        }
    }
}

function handleRemitenteFocus() {
    if (this.value.length >= 2) {
        const filteredRemitentes = filterRemitentes(this.value);
        showRemitenteAutocomplete(filteredRemitentes);
    }
}

function filterRemitentes(searchText) {
    const searchUpper = searchText.toUpperCase();
    return remitentesData.filter(remitente => 
        remitente.nombre.toUpperCase().includes(searchUpper)
    ).slice(0, 8); // Limitar a 8 resultados
}

function showRemitenteAutocomplete(results) {
    if (!remitenteDropdown) {
        console.error('❌ Error: remitenteDropdown no encontrado');
        return;
    }
    
    remitenteDropdown.innerHTML = '';
    
    if (results.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'autocomplete-item';
        noResults.textContent = 'No se encontraron remitentes';
        remitenteDropdown.appendChild(noResults);
    } else {
        results.forEach((remitente) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerHTML = `
                <div class="flex flex-col w-full">
                    <div class="font-medium text-sm">${remitente.nombre}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        ${remitente.telefono ? '📱 ' + remitente.telefono : ''}
                        ${remitente.direccion ? '📍 ' + remitente.direccion.substring(0, 30) + '...' : ''}
                    </div>
                </div>
            `;
            
            item.addEventListener('click', function() {
                console.log('🟡 CLICK en remitente:', remitente.nombre);
                
                // 1. Autocompletar nombre del remitente
                remitenteInput.value = remitente.nombre;
                
                // 2. Buscar y autocompletar teléfono del remitente
                const telefonoCampo = document.getElementById('telefonoRemitente');
                if (telefonoCampo && remitente.telefono) {
                    telefonoCampo.value = remitente.telefono;
                    console.log('✅ Teléfono autocompletado:', remitente.telefono);
                    
                    // Disparar evento input para que otros listeners reaccionen
                    telefonoCampo.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    console.log('⚠️ No se pudo autocompletar teléfono - Campo:', telefonoCampo ? 'Encontrado' : 'No encontrado', 'Dato:', remitente.telefono ? 'Disponible' : 'No disponible');
                }
                
                // 3. Buscar y autocompletar dirección del remitente
                const direccionCampo = document.getElementById('direccionRemitente');
                if (direccionCampo && remitente.direccion) {
                    direccionCampo.value = remitente.direccion;
                    console.log('✅ Dirección autocompletada:', remitente.direccion);
                    
                    // Disparar evento input para que otros listeners reaccionen
                    direccionCampo.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    console.log('⚠️ No se pudo autocompletar dirección - Campo:', direccionCampo ? 'Encontrado' : 'No encontrado', 'Dato:', remitente.direccion ? 'Disponible' : 'No disponible');
                }
                
                // 4. Cerrar dropdown
                remitenteDropdown.style.display = 'none';
                
                // 5. Cambiar foco al siguiente campo (teléfono)
                if (telefonoCampo) {
                    setTimeout(() => telefonoCampo.focus(), 10);
                }
            });
            
            remitenteDropdown.appendChild(item);
        });
    }
    
    remitenteDropdown.style.display = 'block';
}

// ============================================
// FUNCIONES COMPARTIDAS PARA AUTOCOMPLETE
// ============================================

function handleAutocompleteNavigation(e, items, dropdown) {
    let currentFocus = -1;
    items.forEach((item, index) => {
        if (item.classList.contains('highlighted')) {
            currentFocus = index;
        }
    });
    
    if (e.key === 'ArrowDown') {
        currentFocus = (currentFocus + 1) % items.length;
    } else if (e.key === 'ArrowUp') {
        currentFocus = (currentFocus - 1 + items.length) % items.length;
    }
    
    // Limpiar highlights
    items.forEach(item => item.classList.remove('highlighted'));
    
    // Aplicar highlight
    if (items[currentFocus]) {
        items[currentFocus].classList.add('highlighted');
        items[currentFocus].scrollIntoView({ block: 'nearest' });
    }
    
    // Si presiona Enter
    if (e.key === 'Enter' && items[currentFocus]) {
        e.preventDefault();
        items[currentFocus].click();
    }
    
    // Si presiona Escape
    if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        currentFocus = -1;
    }
}

function handleDocumentClick(e) {
    // Cerrar dropdown de barrios
    if (autocompleteDropdown && !barrioInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
        autocompleteDropdown.style.display = 'none';
        currentFocus = -1;
    }
    
    // Cerrar dropdown de remitentes
    if (remitenteInput && remitenteDropdown && 
        !remitenteInput.contains(e.target) && !remitenteDropdown.contains(e.target)) {
        remitenteDropdown.style.display = 'none';
    }
}

// ============================================
// FUNCIONES EXISTENTES (NO MODIFICAR)
// ============================================

function getDefaultBarrios() {
    return [
        { id: "ATB6ZXHU", nombre: "USAQUÉN-SANTA BARBARA ORIENTAL" },
        { id: "1HOGOY32", nombre: "USAQUÉN-SANTA BARBARA CENTRAL" },
        { id: "WYWRDLUX", nombre: "USAQUÉN-CHICO NORTE II SECTOR" },
        { id: "5TKZNTB2", nombre: "USAQUÉN-SANTA BARBARA OCCIDENTAL" },
        { id: "5DUKSNR5", nombre: "USAQUÉN-SAN PATRICIO" },
        { id: "ABC12345", nombre: "USAQUÉN-LOS CEDROS" },
        { id: "DEF67890", nombre: "USAQUÉN-BELLAVISTA" },
        { id: "GHI11223", nombre: "SUBA-SAN JOSÉ DE BAVARIA" },
        { id: "JKL44556", nombre: "SUBA-TIBABUYES" },
        { id: "MNO77889", nombre: "SUBA-EL RINCÓN" },
        { id: "PQR00112", nombre: "SUBA-LA FLORESTA" },
        { id: "STU33445", nombre: "KENNEDY-TIMIZA" },
        { id: "VWX66778", nombre: "KENNEDY-PATIO BONITO" },
        { id: "YZA99001", nombre: "KENNEDY-CASABLANCA" },
        { id: "BCD22334", nombre: "CHAPINERO-CHICÓ" },
        { id: "EFG55667", nombre: "CHAPINERO-EL REFUGIO" },
        { id: "HIJ88990", nombre: "CHAPINERO-LA MACARENA" },
        { id: "KLM11223", nombre: "ENGATIVÁ-EL DORADO" },
        { id: "NOP44556", nombre: "ENGATIVÁ-LA SABANA" },
        { id: "QRS77889", nombre: "ENGATIVÁ-BOYACÁ REAL" },
        { id: "TUV00112", nombre: "SOACHA-CIUDADELA SUBA" },
        { id: "WXY33445", nombre: "SOACHA-ALTOS DE CAZUCA" },
        { id: "ZAB66778", nombre: "SOACHA-SAN MATEO" }
    ];
}

function setupEventListeners() {
    console.log('🔗 Configurando event listeners...');
    
    // Event listeners para las opciones de pago
    paymentOptions.forEach(option => {
        option.addEventListener('click', function() {
            const paymentType = this.getAttribute('data-value');
            updatePaymentUI(paymentType);
        });
    });
    
    // Event listener para cambios en el valor a recaudar
    valorRecaudarInput.addEventListener('input', updateSummary);
    
    // Event listeners para el autocomplete de barrios
    barrioInput.addEventListener('input', handleBarrioInput);
    barrioInput.addEventListener('keydown', handleBarrioKeydown);
    barrioInput.addEventListener('focus', handleBarrioFocus);
    
    // Event listeners para el autocomplete de remitentes
    if (remitenteInput) {
        console.log('✅ Configurando listeners para autocomplete de remitente');
        remitenteInput.addEventListener('input', handleRemitenteInput);
        remitenteInput.addEventListener('keydown', handleRemitenteKeydown);
        remitenteInput.addEventListener('focus', handleRemitenteFocus);
    } else {
        console.error('❌ Error: Campo remitente no encontrado para configurar listeners');
    }
    
    // Cerrar dropdown cuando se hace clic fuera
    document.addEventListener('click', handleDocumentClick);
    
    // Manejar envío del formulario
    document.getElementById('deliveryForm').addEventListener('submit', handleFormSubmit);
    
    // Manejar botón cancelar
    document.getElementById('cancelButton').addEventListener('click', handleCancel);
    
    console.log('✅ Event listeners configurados');
}

function initializeUI() {
    // Generar ID único para el envío
    document.getElementById('envioId').value = generateShippingId();
    
    // Establecer ciudad de origen como Bogotá D.C.
    document.getElementById('ciudadOrigen').value = 'Bogotá D.C.';
    
    // Inicializar UI con contado como opción por defecto
    updatePaymentUI('contado');
}

function updatePaymentUI(selectedPayment) {
    console.log(`💳 Actualizando UI para forma de pago: ${selectedPayment}`);
    
    // Actualizar input hidden
    formaPagoInput.value = selectedPayment;
    
    // Actualizar opciones visuales seleccionadas
    paymentOptions.forEach(option => {
        if (option.getAttribute('data-value') === selectedPayment) {
            option.classList.add('selected');
            option.classList.add('border-primary');
        } else {
            option.classList.remove('selected');
            option.classList.remove('border-primary');
        }
    });
    
    // Actualizar campos según la forma de pago
    switch(selectedPayment) {
        case 'contado':
            valorRecaudarInput.disabled = true;
            valorRecaudarInput.value = '';
            autoRecaudoLabel.classList.add('hidden');
            valorRecaudarHelp.textContent = 'No aplica para pagos de contado';
            valorRecaudarHelp.className = 'text-xs text-gray-500 dark:text-gray-400 mt-1';
            break;
            
        case 'contraentrega':
            valorRecaudarInput.disabled = true;
            valorRecaudarInput.value = '10000';
            autoRecaudoLabel.classList.remove('hidden');
            autoRecaudoLabel.textContent = 'FIJO';
            valorRecaudarHelp.textContent = 'Valor fijo para contraentrega';
            valorRecaudarHelp.className = 'text-xs text-green-600 dark:text-green-400 mt-1';
            break;
            
        case 'contraentrega_recaudo':
            valorRecaudarInput.disabled = false;
            valorRecaudarInput.value = '';
            autoRecaudoLabel.classList.add('hidden');
            valorRecaudarHelp.textContent = 'Ingrese el valor a recaudar al cliente';
            valorRecaudarHelp.className = 'text-xs text-orange-600 dark:text-orange-400 mt-1';
            break;
    }
    
    // Actualizar resumen
    updateSummary();
}

function updateSummary() {
    const formaPagoText = {
        'contado': 'Contado',
        'contraentrega': 'Contraentrega',
        'contraentrega_recaudo': 'Contraentrega con Recaudo'
    };
    
    resumenFormaPago.textContent = formaPagoText[formaPagoInput.value] || 'Contado';
    
    if (formaPagoInput.value === 'contraentrega') {
        resumenValorRecaudar.textContent = '$10,000';
        resumenEstado.textContent = 'Recaudo fijo';
        resumenEstado.className = 'font-semibold text-blue-600 dark:text-blue-400';
    } else if (formaPagoInput.value === 'contraentrega_recaudo') {
        const valor = valorRecaudarInput.value ? `$${parseInt(valorRecaudarInput.value).toLocaleString()}` : '$0';
        resumenValorRecaudar.textContent = valor;
        resumenEstado.textContent = valorRecaudarInput.value ? 'Recaudo variable' : 'Sin valor';
        resumenEstado.className = 'font-semibold text-orange-600 dark:text-orange-400';
    } else {
        resumenValorRecaudar.textContent = '$0';
        resumenEstado.textContent = 'Por confirmar';
        resumenEstado.className = 'font-semibold text-green-600 dark:text-green-400';
    }
}

function generateShippingId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function handleBarrioInput() {
    const searchText = this.value.trim();
    
    // Limpiar ID si el texto está vacío
    if (searchText === '') {
        barrioIdInput.value = '';
    }
    
    if (searchText.length < 2) {
        autocompleteDropdown.style.display = 'none';
        currentFocus = -1;
        return;
    }
    
    filteredBarrios = filterBarrios(searchText);
    showAutocomplete(filteredBarrios);
}

function handleBarrioKeydown(e) {
    if (autocompleteDropdown.style.display === 'block') {
        const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveFocus('down', items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveFocus('up', items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (items[currentFocus]) {
                items[currentFocus].click();
            }
        } else if (e.key === 'Escape') {
            autocompleteDropdown.style.display = 'none';
            currentFocus = -1;
        }
    }
}

function handleBarrioFocus() {
    if (this.value.length >= 2) {
        filteredBarrios = filterBarrios(this.value);
        showAutocomplete(filteredBarrios);
    }
}

function filterBarrios(searchText) {
    const searchUpper = searchText.toUpperCase();
    return barriosData.filter(barrio => 
        barrio.nombre.toUpperCase().includes(searchUpper) ||
        barrio.id.toUpperCase().includes(searchUpper)
    ).slice(0, 10); // Limitar a 10 resultados
}

function showAutocomplete(results) {
    autocompleteDropdown.innerHTML = '';
    
    if (results.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'autocomplete-item';
        noResults.textContent = 'No se encontraron barrios';
        autocompleteDropdown.appendChild(noResults);
    } else {
        results.forEach((barrio, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            if (index === currentFocus) {
                item.classList.add('highlighted');
            }
            item.innerHTML = `
                <span class="barrio-id">${barrio.id}</span>
                ${barrio.nombre}
            `;
            
            item.addEventListener('click', () => {
                barrioInput.value = barrio.nombre;
                barrioIdInput.value = barrio.id;
                autocompleteDropdown.style.display = 'none';
                currentFocus = -1;
                // Remover clase invalid si existía
                barrioInput.classList.remove('invalid');
            });
            
            autocompleteDropdown.appendChild(item);
        });
    }
    
    autocompleteDropdown.style.display = 'block';
}

function moveFocus(direction, items) {
    // Remover highlight actual
    items.forEach(item => item.classList.remove('highlighted'));
    
    if (direction === 'down') {
        currentFocus++;
    } else if (direction === 'up') {
        currentFocus--;
    }
    
    // Asegurar que esté dentro de los límites
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    
    // Aplicar highlight
    if (items[currentFocus]) {
        items[currentFocus].classList.add('highlighted');
        items[currentFocus].scrollIntoView({ block: 'nearest' });
    }
}

function validateForm() {
    const requiredFields = document.querySelectorAll('[required]');
    let isValid = true;
    
    // Remover clases de error previas
    requiredFields.forEach(field => field.classList.remove('invalid'));
    barrioInput.classList.remove('invalid');
    valorRecaudarInput.classList.remove('invalid');
    
    // Validar campos requeridos
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            isValid = false;
            field.classList.add('invalid');
        }
    });
    
    // Validar barrio seleccionado
    if (barrioInput.value.trim() === '' || barrioIdInput.value === '') {
        isValid = false;
        barrioInput.classList.add('invalid');
    }
    
    // Validar valor a recaudar si es contraentrega con recaudo
    if (formaPagoInput.value === 'contraentrega_recaudo') {
        const valor = parseFloat(valorRecaudarInput.value);
        if (!valor || valor <= 0 || isNaN(valor)) {
            isValid = false;
            valorRecaudarInput.classList.add('invalid');
        }
    }
    
    return isValid;
}

// ============================================
// FUNCIÓN ÚNICA getFormData (CORREGIDA)
// ============================================

function getFormData() {
    const barrioNombre = barrioInput.value;
    const localidad = barrioNombre.split('-')[0] || barrioNombre;
    
    // Determinar zona basada en localidad
    let zona = "NORTE"; // Valor por defecto
    if (localidad.includes("SOACHA")) zona = "SUR";
    else if (localidad.includes("KENNEDY") || localidad.includes("USAQUÉN")) zona = "OCCIDENTE";
    else if (localidad.includes("CHAPINERO")) zona = "ORIENTE";
    
    // Determinar mensajero basado en zona
    let mensajero = "CARLOS"; // Valor por defecto
    if (zona === "SUR") mensajero = "JUAN";
    else if (zona === "OCCIDENTE") mensajero = "PEDRO";
    else if (zona === "ORIENTE") mensajero = "ANDRÉS";
    
    return {
        envioId: document.getElementById('envioId').value,
        formaPago: formaPagoInput.value,
        remite: document.getElementById('remitente').value,
        telefono: document.getElementById('telefonoRemitente').value,
        direccion: document.getElementById('direccionRemitente').value,
        ciudad: 'Bogotá D.C.',
        destino: document.getElementById('destinatario').value,
        direccionDestino: document.getElementById('direccionDestino').value,
        barrio: barrioNombre,
        barrioId: barrioIdInput.value,
        telefonoCliente: document.getElementById('telefonoCliente').value,
        complementoDir: document.getElementById('complementoDireccion').value || '',
        ciudadDestino: document.getElementById('ciudadDestino').value,
        localidad: localidad,
        valorRecaudar: valorRecaudarInput.value || '0',
        // totalPagar: calcularTotalPagar(), // Comentado si no se usa
        pagadoRemitente: formaPagoInput.value === 'contado' ? 'true' : 'false',
        fechaRegistro: new Date().toISOString().split('T')[0],
        horaRegistro: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        usuario: 'Alex',
        // NUEVOS CAMPOS:
        zona: zona,
        mensajero: mensajero,
        observaciones: "LLAMAR ANTES DE ENTREGAR"
    };
}

function calcularTotalPagar() {
    const valorRecaudar = parseFloat(valorRecaudarInput.value) || 0;
    const costoEnvio = formaPagoInput.value === 'contado' ? 0 : 5000;
    return (valorRecaudar + costoEnvio).toString();
}

function showLoading(loading) {
    if (loading) {
        submitText.textContent = 'Procesando...';
        submitIcon.innerHTML = 'refresh';
        submitIcon.classList.add('spinner');
        submitButton.disabled = true;
        submitButton.classList.add('opacity-70');
    } else {
        submitText.textContent = 'Registrar Envío';
        submitIcon.innerHTML = 'arrow_forward';
        submitIcon.classList.remove('spinner');
        submitButton.disabled = false;
        submitButton.classList.remove('opacity-70');
    }
}

function enviarDatos(formData) {
    return new Promise((resolve, reject) => {
        // Crear parámetros para la URL
        const params = new URLSearchParams();
        Object.keys(formData).forEach(key => {
            params.append(key, formData[key]);
        });
        
        fetch(WEBAPP_URL, {
            method: 'POST',
            mode: 'no-cors', // Importante para Google Apps Script
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params
        })
        .then(() => {
            // Con 'no-cors' no podemos leer la respuesta, pero asumimos éxito
            resolve('Envío registrado exitosamente');
        })
        .catch(err => {
            reject(err);
        });
    });
}

// ==================== FUNCIÓN PARA ENVIAR FORMULARIO (CORREGIDA) ====================
async function handleFormSubmit(e) { 
    e.preventDefault();
    
    console.log('📤 Enviando formulario...');
    
    if (!validateForm()) {
        showToast('error', 'Error de validación', 'Por favor complete todos los campos requeridos correctamente.');
        return;
    }
    
    // Obtener datos del formulario
    const formData = getFormData();
    
    // Confirmar envío
    const confirmMessage = `¿Confirmar registro de envío?\n\n📋 ID: ${formData.envioId}\n📍 Destino: ${formData.ciudadDestino}\n👤 Cliente: ${formData.destino}\n💰 Valor: $${parseInt(formData.valorRecaudar).toLocaleString()}`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        // Mostrar carga
        showLoading(true);
        
        // 1. Enviar datos a Google Apps Script
        console.log('📡 Enviando a Google Sheets:', formData);
        await enviarDatos(formData);
        
        // 2. Preparar datos para la guía
        const datosGuia = {
            id: formData.envioId,
            guiaId: formData.envioId,
            formaPago: formData.formaPago,
            
            // Remitente
            remitenteNombre: formData.remite,
            remitenteTelefono: formData.telefono,
            remitenteDireccion: formData.direccion,
            remitenteCiudad: formData.ciudad,
            
            // Destinatario
            destinatarioNombre: formData.destino,
            destinatarioTelefono: formData.telefonoCliente,
            destinatarioCiudad: formData.ciudadDestino,
            destinatarioDireccion: formData.direccionDestino,
            complemento: formData.complementoDir,
            barrioLocalidad: formData.barrio,
            barrioId: formData.barrioId,
            
            // Pago
            valorRecaudar: formData.valorRecaudar,
            fecha: new Date().toLocaleDateString('es-CO'),
            fechaCompleta: new Date().toLocaleString('es-CO'),
            
            // Datos adicionales
            zona: formData.zona,
            mensajero: formData.mensajero,
            observaciones: formData.observaciones
        };
        
        console.log('💾 Guardando en localStorage:', datosGuia);
        
        // Guardar en localStorage para la guía
        const envios = JSON.parse(localStorage.getItem('envios')) || [];
        envios.push(datosGuia);
        localStorage.setItem('envios', JSON.stringify(envios));
        localStorage.setItem('ultimoEnvio', JSON.stringify(datosGuia));
        
        // Guardar el ID específico para la guía
        localStorage.setItem('envioParaGuia', formData.envioId);
        
        console.log('✅ Guardado en localStorage completo');
        console.log('📊 Total de envíos guardados:', envios.length);
        
        // 3. Mostrar resultado exitoso
        mostrarResultado(datosGuia);
        
    } catch (error) {
        console.error('❌ Error al enviar datos:', error);
        showToast('error', 'Error de conexión', 'No se pudo conectar con el servidor. Por favor, intente nuevamente.');
    } finally {
        showLoading(false);
    }
}

// ==================== FUNCIÓN PARA MOSTRAR RESULTADO ====================
// En la función mostrarResultado, asegúrate de pasar el ID correcto:
function mostrarResultado(envio) {
    // Ocultar formulario
    document.getElementById('deliveryForm').style.display = 'none';
    
    // Mostrar sección de resultado
    const resultSection = document.getElementById('resultSection');
    resultSection.classList.remove('hidden');
    resultSection.style.display = 'block';
    
    // Llenar datos del resultado
    document.getElementById('resultGuideNumber').textContent = envio.id;
    document.getElementById('resultDestinatario').textContent = envio.destinatarioNombre;
    document.getElementById('resultValor').textContent = `$${parseInt(envio.valorRecaudar || 0).toLocaleString()}`;
    document.getElementById('resultMessage').textContent = 
        `Guía generada exitosamente. Puedes imprimir la guía para el mensajero.`;
    
    // IMPORTANTE: Guardar el ID en localStorage
    localStorage.setItem('envioParaGuia', envio.id);
    console.log('💾 ID guardado para guía:', envio.id);
    
    // Configurar botón de impresión
    document.getElementById('printGuideBtn').onclick = function() {
        abrirGuiaImpresion(envio.id);
    };
    
    // Configurar botón de nuevo envío
    document.getElementById('newDeliveryBtn').onclick = function() {
        location.reload();
    };
}

// ==================== FUNCIÓN PARA ABRIR GUÍA ====================
function abrirGuiaImpresion(envioId) {
    console.log('🖨️ Abriendo guía para ID:', envioId);
    
    // Ya está guardado en mostrarResultado, pero por si acaso:
    localStorage.setItem('envioParaGuia', envioId);
    
    // Abrir guia.html en una nueva pestaña
    window.open('guia.html', '_blank');
}

function resetForm() {
    document.getElementById('deliveryForm').reset();
    document.getElementById('envioId').value = generateShippingId();
    barrioIdInput.value = '';
    updatePaymentUI('contado');
    autocompleteDropdown.style.display = 'none';
    currentFocus = -1;
    
    // Remover clases de error
    document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}

function handleCancel() {
    if (confirm('¿Está seguro de cancelar? Se perderán todos los datos ingresados.')) {
        resetForm();
    }
}

function showToast(type, title, message) {
    // Crear elemento toast
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 translate-x-0 ${
        type === 'success' ? 'bg-green-100 border-green-400 text-green-800' :
        type === 'error' ? 'bg-red-100 border-red-400 text-red-800' :
        'bg-blue-100 border-blue-400 text-blue-800'
    } border-l-4 max-w-sm`;
    
    toast.innerHTML = `
        <div class="flex items-center">
            <span class="material-symbols-outlined mr-2">
                ${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}
            </span>
            <div class="flex-1">
                <strong class="font-semibold">${title}</strong>
                <p class="text-sm mt-1">${message}</p>
            </div>
            <button class="ml-4 text-gray-500 hover:text-gray-700" onclick="this.parentElement.parentElement.remove()">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// ============================================
// INICIALIZACIÓN FINAL
// ============================================

document.addEventListener('DOMContentLoaded', initApp);