
// login.js - VERSIÓN SEGURA
async function cargarUsuarios() {
  try {
    const timestamp = new Date().getTime();
    const response = await fetch(`usuarios.json?t=${timestamp}`);
    
    if (!response.ok) {
      console.error("Error cargando usuarios:", response.status);
      return [];
    }
    
    const data = await response.json();
    
    // NO mostrar datos sensibles en consola
    console.log(`✅ ${data.length} usuarios cargados correctamente`);
    
    // Solo para debug en desarrollo, mostrar info segura
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      console.log("🔍 Usuarios disponibles (solo desarrollo):");
      data.forEach(user => {
        console.log(`  • ${user.USUARIO} (${user.ROL}) - Estado: ${user.ESTADO}`);
      });
    }
    
    return data;
  } catch (error) {
    console.error("❌ Error cargando usuarios:", error);
    return [];
  }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const usuarioInput = document.getElementById("usuario").value.trim();
  const passwordInput = document.getElementById("password").value.trim();
  
  // Validaciones básicas
  if (!usuarioInput || !passwordInput) {
    mostrarError("Por favor complete ambos campos");
    return;
  }
  
  // Mostrar loading
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Verificando...";
  submitBtn.disabled = true;

  try {
    const usuarios = await cargarUsuarios();
    
    // DEPURACIÓN SEGURA - Solo muestra si el usuario existe
    console.log(`🔐 Buscando usuario: ${usuarioInput}`);
    
    const user = usuarios.find(u => 
      u.USUARIO === usuarioInput && 
      u.CONTRASEÑA === passwordInput && 
      u.ESTADO === "ACTIVO"
    );

    if (user) {
      // NO mostrar datos sensibles del usuario
      console.log(`✅ Autenticación exitosa para: ${user.USUARIO}`);
      
      // Guardar datos necesarios (sin contraseña)
      const datosUsuario = {
        "USUARIO": user.USUARIO,
        "NOMBRE COMPLETO": user["NOMBRE COMPLETO"],
        "ROL": user.ROL,
        "ESTADO": user.ESTADO,
        "NOMBRE REMITENTE": user["NOMBRE REMITENTE"] || user["NOMBRE COMPLETO"],
        "DIRECCION REMITENTE": user["DIRECCION REMITENTE"] || "",
        "TELEFONO REMITENTE": user["TELEFONO REMITENTE"] || user["TELEFONO"] || "",
        "CIUDAD": user.CIUDAD || "Bogotá D.C.",
        "EMAIL": user.EMAIL || "",
        "FECHA_REGISTRO": user["FECHA_REGISTRO"] || "",
        "ULTIMO_LOGIN": new Date().toISOString()
      };
      
      localStorage.setItem("usuarioLogueado", JSON.stringify(datosUsuario));
      localStorage.setItem("session_start", new Date().toISOString());
      
      // Limpiar campo de contraseña por seguridad
      document.getElementById("password").value = "";
      
      // Redirigir
      window.location.href = "index.html";
      
    } else {
      mostrarError("Usuario o contraseña incorrectos");
      console.log("❌ Autenticación fallida");
      document.getElementById("password").value = "";
    }
    
  } catch (error) {
    console.error("Error en login:", error);
    mostrarError("Error al conectar con el servidor");
  } finally {
    // Restaurar botón
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Función para mostrar errores de forma segura
function mostrarError(mensaje) {
  const errorDiv = document.getElementById("error-message") || crearElementoError();
  errorDiv.textContent = mensaje;
  errorDiv.style.display = "block";
  
  setTimeout(() => {
    errorDiv.style.display = "none";
  }, 5000);
}

function crearElementoError() {
  const div = document.createElement("div");
  div.id = "error-message";
  div.style.cssText = `
    background-color: #fee;
    color: #c00;
    padding: 10px;
    margin: 10px 0;
    border-radius: 5px;
    border: 1px solid #fcc;
    display: none;
  `;
  document.getElementById("loginForm").prepend(div);
  return div;
}

// Verificar si ya hay sesión activa
document.addEventListener('DOMContentLoaded', function() {
  const usuarioGuardado = localStorage.getItem("usuarioLogueado");
  
  if (usuarioGuardado) {
    try {
      const usuario = JSON.parse(usuarioGuardado);
      
      // Solo redirigir si el usuario está activo y no ha expirado la sesión
      const sessionStart = localStorage.getItem("session_start");
      if (sessionStart) {
        const sessionTime = new Date() - new Date(sessionStart);
        const horasExpiracion = 8; // Sesión de 8 horas
        
        if (usuario.ESTADO === "ACTIVO" && sessionTime < (horasExpiracion * 60 * 60 * 1000)) {
          console.log("✅ Sesión activa encontrada, redirigiendo...");
          window.location.href = "index.html";
        } else {
          // Sesión expirada, limpiar
          console.log("⚠️ Sesión expirada, limpiando...");
          localStorage.removeItem("usuarioLogueado");
          localStorage.removeItem("session_start");
        }
      }
    } catch (error) {
      console.error("Error verificando sesión:", error);
      localStorage.clear();
    }
  }
});
