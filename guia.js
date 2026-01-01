// ============================================
// CONFIGURACIÓN
// ============================================
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIipuPmVAvaTt7_oUQzMLNtXIah19dcq2CWkaoglQvFivqY-wBYEw64tvUmL4-1k62/exec";

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Iniciando generación de guía...');
    cargarDatosEnvio();
});

// ============================================
// FUNCIÓN PRINCIPAL - CARGAR DATOS DEL ENVÍO
// ============================================
async function cargarDatosEnvio() {
    try {
        // Obtener ID del envío
        const envioId = obtenerEnvioId();
        console.log('🔍 Buscando envío ID:', envioId);
        
        if (!envioId) {
            mostrarError('No se encontró ID de envío');
            return;
        }

        // Cargar datos
        let datosEnvio = await cargarDatos(envioId);
        
        if (!datosEnvio) {
            mostrarError('No se pudieron cargar los datos del envío');
            return;
        }

        // Generar guía
        generarGuia(datosEnvio);
        
        // Generar código de barras
        generarCodigoBarras(envioId);
        
        console.log('✅ Guía generada exitosamente');

    } catch (error) {
        console.error('❌ Error cargando datos:', error);
        mostrarError('Error al cargar datos: ' + error.message);
    }
}

// ============================================
// OBTENER ID DEL ENVÍO
// ============================================
function obtenerEnvioId() {
    // 1. Intentar desde URL (para reimpresión desde historial)
    const urlParams = new URLSearchParams(window.location.search);
    let envioId = urlParams.get('id') || urlParams.get('envio');
    
    if (envioId) {
        console.log('📋 ID obtenido de URL:', envioId);
        return envioId;
    }
    
    // 2. Intentar desde localStorage
    envioId = localStorage.getItem('envioParaGuia');
    
    if (envioId) {
        console.log('📋 ID obtenido de localStorage:', envioId);
        return envioId;
    }
    
    // 3. Intentar desde datos completos
    const datosCompletos = localStorage.getItem('ultimoEnvioCompleto');
    if (datosCompletos) {
        try {
            const datos = JSON.parse(datosCompletos);
            envioId = datos.envioId || datos["ENVIO ID"] || datos.id;
            console.log('📋 ID obtenido de datos completos:', envioId);
            return envioId;
        } catch (e) {
            console.error('Error parseando datos completos:', e);
        }
    }
    
    console.error('❌ No se pudo obtener ID del envío');
    return null;
}

// ============================================
// CARGAR DATOS DEL ENVÍO
// ============================================
async function cargarDatos(envioId) {
    console.log('📡 Cargando datos para ID:', envioId);
    
    // 1. Intentar desde localStorage (datos completos recientes)
    const datosCompletos = localStorage.getItem('ultimoEnvioCompleto');
    if (datosCompletos) {
        try {
            const datos = JSON.parse(datosCompletos);
            if (datos.envioId === envioId || datos["ENVIO ID"] === envioId || datos.id === envioId) {
                console.log('✅ Datos cargados desde localStorage (recientes)');
                return procesarDatos(datos);
            }
        } catch (e) {
            console.error('Error parseando datos locales:', e);
        }
    }
    
    // 2. Intentar desde historial en localStorage
    try {
        const historial = JSON.parse(localStorage.getItem('historialCompleto')) || [];
        console.log(`🔍 Buscando ${envioId} en historial de ${historial.length} envíos`);
        
        // Buscar envío en el historial
        const envio = historial.find(e => 
            e["ENVIO ID"] === envioId || 
            e.id === envioId || 
            e.envioId === envioId ||
            (e.ID && e.ID.toString() === envioId.toString())
        );
        
        if (envio) {
            console.log('✅ Datos cargados desde historial local:', envio);
            return procesarDatos(envio);
        }
    } catch (e) {
        console.error('Error buscando en historial:', e);
    }
    
    // 3. Intentar desde Web App
    try {
        console.log('🌐 Intentando cargar desde Web App...');
        const response = await fetch(`${WEB_APP_URL}?action=getEnvio&envioId=${encodeURIComponent(envioId)}`);
        
        if (response.ok) {
            const datos = await response.json();
            console.log('✅ Datos cargados desde Web App:', datos);
            return procesarDatos(datos);
        }
    } catch (error) {
        console.log('⚠️ No se pudo cargar desde Web App:', error.message);
    }
    
    // 4. Crear datos de ejemplo si todo falla
    console.log('⚠️ Usando datos de ejemplo');
    return crearDatosEjemplo(envioId);
}

// ============================================
// CREAR DATOS DE EJEMPLO
// ============================================
function crearDatosEjemplo(envioId) {
    return {
        "ENVIO ID": envioId,
        "REMITE": "CLIENTE DE EJEMPLO",
        "TELEFONO": "3001234567",
        "CIUDAD": "Bogotá D.C.",
        "DESTINO": "DESTINATARIO EJEMPLO",
        "TELEFONOCLIENTE": "3109876543",
        "DIRECCION DESTINO": "Calle 123 #45-67",
        "BARRIO": "Barrio Ejemplo",
        "COMPLEMENTO DE DIR": "Oficina 202",
        "CIUDAD DESTINO": "Bogotá D.C.",
        "FORMA DE PAGO": "Contraentrega",
        "VALOR A RECAUDAR": "100000",
        "OBS": "Entregar antes de las 6 PM",
        fecha: new Date().toISOString()
    };
}

// ============================================
// PROCESAR DATOS
// ============================================
function procesarDatos(datos) {
    console.log('🔧 Procesando datos:', datos);
    
    // Normalizar nombres de campos
    const datosNormalizados = {
        // ID
        "ENVIO ID": datos["ENVIO ID"] || datos.envioId || datos.id || datos.ID || "N/A",
        
        // Remitente
        "REMITE": datos["REMITE"] || datos.remite || datos.REMITE || "N/A",
        "TELEFONO": datos["TELEFONO"] || datos.telefono || datos.TELEFONO || "N/A",
        "CIUDAD": datos["CIUDAD"] || datos.ciudad || datos.CIUDAD || "Bogotá D.C.",
        
        // Destinatario
        "DESTINO": datos["DESTINO"] || datos.destino || datos.DESTINO || "N/A",
        "TELEFONOCLIENTE": datos["TELEFONOCLIENTE"] || datos.telefonoCliente || datos.TELEFONOCLIENTE || "N/A",
        "DIRECCION DESTINO": datos["DIRECCION DESTINO"] || datos.direccionDestino || datos["DIRECCION DESTINO"] || "N/A",
        "BARRIO": datos["BARRIO"] || datos.barrio || datos.BARRIO || "N/A",
        "COMPLEMENTO DE DIR": datos["COMPLEMENTO DE DIR"] || datos.complementoDir || datos["COMPLEMENTO DE DIR"] || "Ninguno",
        "CIUDAD DESTINO": datos["CIUDAD DESTINO"] || datos.ciudadDestino || datos["CIUDAD DESTINO"] || "Bogotá D.C.",
        
        // Pago
        "FORMA DE PAGO": datos["FORMA DE PAGO"] || datos.formaPago || datos["FORMA DE PAGO"] || "Contraentrega",
        "VALOR A RECAUDAR": datos["VALOR A RECAUDAR"] || datos.valorRecaudar || datos["VALOR A RECAUDAR"] || "0",
        
        // Observaciones
        "OBS": datos["OBS"] || datos.observaciones || datos.OBS || "",
        
        // Fecha
        fecha: datos.fecha || datos.fechaCreacion || new Date().toISOString()
    };
    
    // Formatear valor a recaudar
    if (datosNormalizados["VALOR A RECAUDAR"]) {
        const valor = parseFloat(datosNormalizados["VALOR A RECAUDAR"]);
        if (!isNaN(valor)) {
            datosNormalizados.valorFormateado = `$${valor.toLocaleString('es-CO')}`;
        } else {
            datosNormalizados.valorFormateado = "$0";
        }
    }
    
    // Formatear fecha
    const fecha = new Date(datosNormalizados.fecha);
    datosNormalizados.fechaFormateada = fecha.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    return datosNormalizados;
}

// ============================================
// GENERAR CÓDIGO DE BARRAS
// ============================================
function generarCodigoBarras(envioId) {
    try {
        console.log('📊 Generando código de barras para:', envioId);
        
        // Verificar que tenemos el elemento SVG
        const svgElement = document.getElementById('codigoBarras');
        if (!svgElement) {
            console.error('❌ No se encontró el elemento SVG para código de barras');
            return;
        }
        
        // Verificar que JsBarcode está disponible
        if (typeof JsBarcode === 'undefined') {
            console.error('❌ JsBarcode no está disponible');
            mostrarError('No se pudo cargar la librería de código de barras');
            return;
        }
        
        // Limpiar SVG existente
        svgElement.innerHTML = '';
        
        // Generar código de barras
        JsBarcode("#codigoBarras", envioId, {
            format: "CODE128",
            width: 1.2,
            height: 28,
            displayValue: false,
            background: "transparent",
            lineColor: "#000000",
            margin: 2
        });
        
        console.log('✅ Código de barras generado');
        
        // También mostrar el número debajo
        const numeroElement = document.getElementById('numeroGuiaBarras');
        if (numeroElement) {
            numeroElement.textContent = envioId;
        }
        
    } catch (error) {
        console.error('❌ Error generando código de barras:', error);
        // Mostrar el número aunque falle el código de barras
        const numeroElement = document.getElementById('numeroGuiaBarras');
        if (numeroElement) {
            numeroElement.textContent = envioId;
            numeroElement.style.color = '#000';
            numeroElement.style.fontWeight = 'bold';
        }
    }
}

// ============================================
// GENERAR GUÍA
// ============================================
function generarGuia(datos) {
    console.log('🎨 Generando interfaz de guía...');
    
    // Actualizar elementos de la guía
    actualizarElemento('guiaId', datos["ENVIO ID"]);
    actualizarElemento('fecha', datos.fechaFormateada);
    actualizarElemento('fechaGeneracion', new Date().toLocaleString('es-CO'));
    
    // Forma de pago
    const formaPago = datos["FORMA DE PAGO"] || '';
    let formaPagoTexto = '';
    switch(formaPago.toLowerCase()) {
        case 'contado': formaPagoTexto = 'Contado'; break;
        case 'contraentrega': formaPagoTexto = 'Contraentrega'; break;
        case 'contraentrega_recaudo': 
        case 'con recaudo':
            formaPagoTexto = 'Con Recaudo'; 
            break;
        default: formaPagoTexto = formaPago || 'N/A';
    }
    actualizarElemento('formaPago', formaPagoTexto);
    
    // Remitente
    actualizarElemento('remitenteNombre', datos["REMITE"]);
    actualizarElemento('remitenteTelefono', datos["TELEFONO"]);
    actualizarElemento('remitenteCiudad', datos["CIUDAD"]);
    
    // Destinatario
    actualizarElemento('destinatarioNombre', datos["DESTINO"]);
    actualizarElemento('destinatarioTelefono', datos["TELEFONOCLIENTE"]);
    actualizarElemento('destinatarioDireccion', datos["DIRECCION DESTINO"]);
    actualizarElemento('destinatarioBarrio', datos["BARRIO"]);
    actualizarElemento('destinatarioCiudad', datos["CIUDAD DESTINO"]);
    actualizarElemento('complemento', datos["COMPLEMENTO DE DIR"]);
    
    // Información de pago
    actualizarElemento('valorRecaudar', datos.valorFormateado || `$${parseInt(datos["VALOR A RECAUDAR"] || 0).toLocaleString('es-CO')}`);
    
    console.log('✅ Interfaz de guía actualizada');
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================
function actualizarElemento(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.textContent = valor || '';
        console.log(`✓ ${id}: ${valor}`);
    } else {
        console.warn(`⚠️ Elemento no encontrado: ${id}`);
    }
}

function mostrarError(mensaje) {
    console.error('❌ Error:', mensaje);
    
    // Mostrar mensaje en la guía
    const elementosError = document.querySelectorAll('[id]');
    elementosError.forEach(elemento => {
        if (elemento.id !== 'codigoBarras' && elemento.id !== 'numeroGuiaBarras') {
            elemento.textContent = 'ERROR';
            elemento.style.color = '#ff0000';
        }
    });
    
    // Mensaje específico
    const guiaId = document.getElementById('guiaId');
    if (guiaId) {
        guiaId.textContent = 'ERROR';
        guiaId.style.color = '#ff0000';
    }
    
    alert(`Error: ${mensaje}\n\nPor favor intente nuevamente.`);
}

// ============================================
// PARA DEBUGGING
// ============================================
window.debugGuia = function() {
    console.log('=== DEBUG GUÍA ===');
    console.log('URL:', window.location.href);
    console.log('ID de envío:', obtenerEnvioId());
    console.log('Elementos encontrados:');
    
    const elementosIds = [
        'guiaId', 'fecha', 'formaPago', 'remitenteNombre',
        'remitenteTelefono', 'remitenteCiudad', 'destinatarioNombre',
        'destinatarioTelefono', 'destinatarioDireccion', 'destinatarioBarrio',
        'destinatarioCiudad', 'complemento', 'valorRecaudar'
    ];
    
    elementosIds.forEach(id => {
        const elem = document.getElementById(id);
        console.log(`  ${id}:`, elem ? 'ENCONTRADO' : 'NO ENCONTRADO', elem ? `("${elem.textContent}")` : '');
    });
    
    console.log('=== FIN DEBUG ===');
};
