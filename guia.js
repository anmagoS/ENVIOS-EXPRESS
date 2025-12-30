// guia.js - VERSIÓN COMPLETA Y FUNCIONAL
console.log('🎯 guia.js iniciado - ID:', localStorage.getItem('envioParaGuia'));

document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 DOM cargado');
    
    const envioId = localStorage.getItem('envioParaGuia');
    console.log('🔍 ID a buscar:', envioId);
    
    if (!envioId) {
        mostrarError('No se encontró el ID del envío.');
        return;
    }
    
    buscarEnSheets(envioId);
    configurarBotones();
});

// ==================== BUSCAR EN SHEETS ====================
function buscarEnSheets(envioId) {
    console.log('📡 Buscando en Sheets...');
    
    // ✅ CORRECTO: Usa la Web App 2 para buscar
    const url = `https://script.google.com/macros/s/AKfycbwQalnfttGxp8prBg8FmSVtxCclnnBI-Ttvprk3DCKQW6fart5HllZuo9Q9wY8knBO1/exec?action=obtenerGuia&id=${envioId}`;
    
    console.log('🔗 URL de búsqueda:', url);
    
    fetch(url)
        .then(response => {
            console.log('📥 Status:', response.status, 'OK:', response.ok);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json(); // Directamente a JSON
        })
        .then(data => {
            console.log('✅ Datos recibidos:', data);
            
            // Verificar diferentes formatos de respuesta
            if (data.error) {
                mostrarError('Error: ' + data.error);
            } else if (data.success === false) {
                mostrarError('Error en la API: ' + (data.mensaje || data.error));
            } else if (data.encontrado === false) {
                mostrarError('Envío no encontrado en la base de datos. ID: ' + envioId);
            } else if (data.success === true && data.encontrado === true) {
                cargarDatosEnGuia(data);
                setTimeout(() => generarQR(data), 100);
            } else {
                // Si llega un formato diferente, intentar procesarlo
                console.warn('⚠️ Formato de respuesta diferente, intentando procesar...');
                cargarDatosEnGuia(data);
            }
        })
        .catch(error => {
            console.error('❌ Error fetch:', error);
            mostrarError('Error de conexión: ' + error.message);
        });
}

// ==================== CARGAR DATOS EN GUÍA (MEJORADO) ====================
function cargarDatosEnGuia(datos) {
    console.log('📝 Cargando datos en guía:', datos);
    
    try {
        // Fechas
        const fecha = new Date().toLocaleDateString('es-CO');
        const fechaHora = new Date().toLocaleString('es-CO');
        
        // ENCABEZADO
        document.getElementById('guiaId').textContent = datos.envioId || datos.id || 'Sin ID';
        document.getElementById('fecha').textContent = fecha;
        document.getElementById('formaPago').textContent = (datos.formaPago || 'CONTRAENTREGA').toUpperCase();
        
        // REMITENTE
        document.getElementById('remitenteNombre').textContent = (datos.remite || datos.remitenteNombre || 'Sin nombre').toUpperCase();
        document.getElementById('remitenteTelefono').textContent = datos.telefono || datos.remitenteTelefono || 'Sin teléfono';
        document.getElementById('remitenteCiudad').textContent = datos.ciudad || datos.remitenteCiudad || 'Bogotá D.C.';
        
        // DESTINATARIO
        document.getElementById('destinatarioNombre').textContent = (datos.destino || datos.destinatarioNombre || 'Sin nombre').toUpperCase();
        document.getElementById('destinatarioTelefono').textContent = datos.telefonoCliente || datos.destinatarioTelefono || 'Sin teléfono';
        document.getElementById('destinatarioDireccion').textContent = datos.direccionDestino || datos.destinatarioDireccion || 'Sin dirección';
        document.getElementById('destinatarioBarrio').textContent = (datos.barrio || datos.barrioLocalidad || 'Sin barrio').toUpperCase();
        document.getElementById('destinatarioCiudad').textContent = datos.ciudadDestino || datos.destinatarioCiudad || 'Sin ciudad';
        document.getElementById('complemento').textContent = datos.complementoDir || datos.complemento || '';
        
        // PAGO
        const valor = parseInt(datos.valorRecaudar || 0);
        document.getElementById('valorRecaudar').textContent = `$${valor.toLocaleString('es-CO')}`;
        
        // LOGÍSTICA
        document.getElementById('zona').textContent = datos.localidad || datos.zona || 'Por asignar';
        document.getElementById('mensajero').textContent = datos.mensajero || 'Por asignar';
        document.getElementById('observaciones').textContent = datos.observaciones || '';
        
        // FECHA
        document.getElementById('fechaGeneracion').textContent = fechaHora;
        
        console.log('✅ Guía cargada correctamente');
        console.log('📍 Localidad:', datos.localidad);
        console.log('🚚 Mensajero:', datos.mensajero);
        
    } catch (error) {
        console.error('❌ Error cargando guía:', error);
        mostrarError('Error al cargar datos: ' + error.message);
    }
}

// ==================== GENERAR QR ====================
function generarQR(datos) {
    console.log('🔳 Generando QR...');
    
    // Verificar que QRCode esté disponible
    if (typeof QRCode === 'undefined') {
        console.error('❌ QRCode no está definido');
        document.getElementById('qrData').textContent = 'QR no disponible';
        
        // Intentar cargar la librería dinámicamente
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js';
        script.onload = () => {
            console.log('✅ QRCode cargado dinámicamente');
            generarQR(datos); // Reintentar
        };
        document.head.appendChild(script);
        return;
    }
    
    try {
        // Preparar datos para QR
        const qrData = JSON.stringify({
            id: datos.envioId || datos.id || '',
            telefono: datos.telefonoCliente || datos.destinatarioTelefono || '',
            valor: datos.valorRecaudar || '0',
            destino: datos.destino || datos.destinatarioNombre || ''
        });
        
        console.log('📱 QR Data:', qrData);
        
        document.getElementById('qrData').textContent = qrData;
        
        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = '';
        
        // Generar QR
        new QRCode(qrContainer, {
            text: qrData,
            width: 80,
            height: 80,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
        
        console.log('✅ QR generado correctamente');
        
    } catch (error) {
        console.error('❌ Error generando QR:', error);
        document.getElementById('qrData').textContent = 'Error QR: ' + error.message;
    }
}

// ==================== CONFIGURAR BOTONES ====================
function configurarBotones() {
    const printBtn = document.querySelector('.btn-print');
    const closeBtn = document.querySelector('.btn-close');
    
    if (printBtn) {
        printBtn.onclick = () => {
            console.log('🖨️ Imprimiendo guía...');
            window.print();
        };
    }
    
    if (closeBtn) {
        closeBtn.onclick = () => {
            console.log('❌ Cerrando ventana...');
            window.close();
        };
    }
}

// ==================== MOSTRAR ERROR ====================
function mostrarError(mensaje) {
    console.error('🛑 Error:', mensaje);
    
    const container = document.querySelector('.guia-container');
    container.innerHTML = `
        <div style="padding: 30px; text-align: center;">
            <h2 style="color: #e74c3c; margin-bottom: 20px;">⚠️ Error</h2>
            <p style="margin-bottom: 15px;">${mensaje}</p>
            <p style="font-size: 12px; color: #666; margin-bottom: 20px;">
                ID: ${localStorage.getItem('envioParaGuia')}<br>
                Hora: ${new Date().toLocaleTimeString()}
            </p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="window.close()" style="padding: 10px 20px; background: #135bec; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Cerrar
                </button>
                <button onclick="location.href='index.html'" style="padding: 10px 20px; background: transparent; color: #135bec; border: 2px solid #135bec; border-radius: 5px; cursor: pointer;">
                    Volver
                </button>
            </div>
        </div>
    `;
}

