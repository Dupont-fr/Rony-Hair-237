const axios = require('axios')

const config = {
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  EMAIL_USER: process.env.EMAIL_USER || 'dupontdjeague@gmail.com',
}

const sendEmail = async (to, subject, html, retries = 3) => {
  if (!config.BREVO_API_KEY) throw new Error('Brevo API key non configurée')
  if (!to || !subject || !html) throw new Error('Paramètres email invalides')

  const plainText = html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

  const emailData = {
    sender: { name: 'RONY HAIR 237', email: config.EMAIL_USER },
    to: [{ email: to.trim().toLowerCase(), name: to.split('@')[0] }],
    subject,
    htmlContent: html,
    textContent: plainText,
    replyTo: { email: config.EMAIL_USER, name: 'RONY HAIR 237' },
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios({
        method: 'post',
        url: 'https://api.brevo.com/v3/smtp/email',
        headers: {
          'api-key': config.BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        data: emailData,
        timeout: 10000,
      })

      return { success: true, messageId: response.data.messageId, data: response.data }
    } catch (error) {
      if (error.response) {
        if (error.response.status === 401) throw new Error('Clé API Brevo invalide')
        if (error.response.status === 400) throw new Error(`Paramètres email invalides: ${JSON.stringify(error.response.data)}`)
      }

      if (attempt === retries) {
        throw new Error(`Échec envoi email après ${retries} tentatives: ${error.message}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }
}

const checkBrevoConfig = () => {
  if (!config.BREVO_API_KEY) { console.error('BREVO_API_KEY manquante dans .env'); return false }
  if (!config.EMAIL_USER) { console.error('EMAIL_USER manquant dans .env'); return false }
  return true
}

module.exports = { sendEmail, checkBrevoConfig }
