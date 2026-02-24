// emailConfig.js
const axios = require('axios')

// Configuration
const config = {
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  EMAIL_USER: process.env.EMAIL_USER || 'dupontdjeague@gmail.com',
}

console.log(
  '🔑 BREVO_API_KEY:',
  config.BREVO_API_KEY ? 'Présente' : 'MANQUANTE',
)
console.log('📧 EMAIL_USER:', config.EMAIL_USER)

// Fonction pour envoyer un email via l'API REST Brevo
const sendEmail = async (to, subject, html, retries = 3) => {
  if (!config.BREVO_API_KEY) {
    throw new Error('Brevo API key non configurée')
  }

  if (!to || !subject || !html) {
    throw new Error('Paramètres email invalides')
  }

  // Version texte brut du HTML
  const plainText = html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

  // Construction de la requête
  const emailData = {
    sender: {
      name: 'RONY HAIR 237',
      email: config.EMAIL_USER,
    },
    to: [
      {
        email: to.trim().toLowerCase(),
        name: to.split('@')[0], // Nom par défaut basé sur l'email
      },
    ],
    subject: subject,
    htmlContent: html,
    textContent: plainText,
    // Optionnel : ajouter un replyTo
    replyTo: {
      email: config.EMAIL_USER,
      name: 'RONY HAIR 237',
    },
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📤 Envoi email à ${to} (tentative ${attempt}/${retries})`)

      const response = await axios({
        method: 'post',
        url: 'https://api.brevo.com/v3/smtp/email',
        headers: {
          'api-key': config.BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        data: emailData,
        timeout: 10000, // 10 secondes de timeout
      })

      console.log(`✅ Email envoyé avec succès à ${to}`)
      console.log(`📧 Message ID: ${response.data.messageId}`)

      return {
        success: true,
        messageId: response.data.messageId,
        data: response.data,
      }
    } catch (error) {
      // Gestion détaillée des erreurs
      if (error.response) {
        // Erreur retournée par Brevo
        console.error(`❌ Erreur Brevo (status ${error.response.status}):`)
        console.error('Détails:', error.response.data)

        if (error.response.status === 401) {
          throw new Error('Clé API Brevo invalide')
        } else if (error.response.status === 400) {
          throw new Error(
            `Paramètres email invalides: ${JSON.stringify(error.response.data)}`,
          )
        }
      } else if (error.request) {
        // Pas de réponse reçue
        console.error('❌ Pas de réponse de Brevo:', error.message)
      } else {
        // Erreur de configuration
        console.error('❌ Erreur:', error.message)
      }

      if (attempt === retries) {
        throw new Error(
          `Échec envoi email après ${retries} tentatives: ${error.message}`,
        )
      }

      // Attente exponentielle avant réessai
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }
}

// Fonction utilitaire pour vérifier la configuration
const checkBrevoConfig = () => {
  if (!config.BREVO_API_KEY) {
    console.error('❌ BREVO_API_KEY manquante dans .env')
    return false
  }
  if (!config.EMAIL_USER) {
    console.error('❌ EMAIL_USER manquant dans .env')
    return false
  }
  console.log('✅ Configuration Brevo valide')
  return true
}

module.exports = { sendEmail, checkBrevoConfig }
