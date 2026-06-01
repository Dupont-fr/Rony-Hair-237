const express = require('express')
const router = express.Router()
const Admin = require('../models/Admin')
const { verifyAdmin, generateToken } = require('../utils/adminAuth')

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis.' })
    }

    const admin = await Admin.findOne({ email })

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects.' })
    }

    const isPasswordValid = await admin.comparePassword(password)

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects.' })
    }

    if (!admin.actif) {
      return res.status(403).json({ success: false, message: 'Compte désactivé.' })
    }

    const token = generateToken(admin)

    admin.derniereConnexion = new Date()
    await admin.save()

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    })

    res.json({
      success: true,
      message: 'Connexion réussie',
      admin: { id: admin._id, nom: admin.nom, email: admin.email, role: admin.role },
    })
  } catch (error) {
    console.error('Erreur login admin:', error)
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la connexion.' })
  }
})

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })

  res.json({ success: true, message: 'Déconnexion réussie' })
})

router.get('/me', verifyAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password')

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Administrateur introuvable.' })
    }

    res.json({
      success: true,
      admin: { id: admin._id, nom: admin.nom, email: admin.email, role: admin.role, derniereConnexion: admin.derniereConnexion },
    })
  } catch (error) {
    console.error('Erreur récupération admin:', error)
    res.status(500).json({ success: false, message: 'Erreur serveur.' })
  }
})

router.post('/create-first', async (req, res) => {
  try {
    const existingAdmin = await Admin.findOne()

    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Un administrateur existe déjà.' })
    }

    const { nom, email, password } = req.body

    if (!nom || !email || !password) {
      return res.status(400).json({ success: false, message: 'Tous les champs sont requis.' })
    }

    const admin = await Admin.create({ nom, email, password, role: 'super_admin', actif: true })

    res.status(201).json({
      success: true,
      message: 'Premier administrateur créé avec succès',
      admin: { id: admin._id, nom: admin.nom, email: admin.email, role: admin.role },
    })
  } catch (error) {
    console.error('Erreur création admin:', error)
    res.status(500).json({ success: false, message: 'Erreur lors de la création.' })
  }
})

router.post('/create', verifyAdmin, async (req, res) => {
  try {
    const currentAdmin = await Admin.findById(req.admin.id)

    if (currentAdmin.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Seuls les super-administrateurs peuvent créer des comptes.' })
    }

    const { nom, email, password, role } = req.body

    if (!nom || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nom, email et mot de passe requis.' })
    }

    const existingAdmin = await Admin.findOne({ email })
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé.' })
    }

    const newAdmin = await Admin.create({ nom, email, password, role: role || 'admin', actif: true })

    res.status(201).json({
      success: true,
      message: 'Administrateur créé avec succès',
      admin: { id: newAdmin._id, nom: newAdmin.nom, email: newAdmin.email, role: newAdmin.role },
    })
  } catch (error) {
    console.error('Erreur création admin:', error)
    res.status(500).json({ success: false, message: 'Erreur lors de la création.' })
  }
})

router.get('/list', verifyAdmin, async (req, res) => {
  try {
    const currentAdmin = await Admin.findById(req.admin.id)

    if (currentAdmin.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Accès refusé.' })
    }

    const admins = await Admin.find().select('-password').sort({ createdAt: -1 })

    res.json({
      success: true,
      count: admins.length,
      admins: admins.map((admin) => ({
        id: admin._id, nom: admin.nom, email: admin.email,
        role: admin.role, actif: admin.actif,
        derniereConnexion: admin.derniereConnexion, createdAt: admin.createdAt,
      })),
    })
  } catch (error) {
    console.error('Erreur liste admins:', error)
    res.status(500).json({ success: false, message: 'Erreur serveur.' })
  }
})

router.put('/:id/toggle-status', verifyAdmin, async (req, res) => {
  try {
    const currentAdmin = await Admin.findById(req.admin.id)

    if (currentAdmin.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Accès refusé.' })
    }

    if (req.params.id === req.admin.id) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas modifier votre propre statut.' })
    }

    const admin = await Admin.findById(req.params.id)

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Administrateur introuvable.' })
    }

    admin.actif = !admin.actif
    await admin.save()

    res.json({
      success: true,
      message: `Administrateur ${admin.actif ? 'activé' : 'désactivé'}`,
      admin: { id: admin._id, nom: admin.nom, email: admin.email, actif: admin.actif },
    })
  } catch (error) {
    console.error('Erreur toggle status:', error)
    res.status(500).json({ success: false, message: 'Erreur serveur.' })
  }
})

router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const currentAdmin = await Admin.findById(req.admin.id)

    if (currentAdmin.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Accès refusé.' })
    }

    if (req.params.id === req.admin.id) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte.' })
    }

    const admin = await Admin.findById(req.params.id)

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Administrateur introuvable.' })
    }

    await admin.deleteOne()

    res.json({ success: true, message: 'Administrateur supprimé avec succès' })
  } catch (error) {
    console.error('Erreur suppression admin:', error)
    res.status(500).json({ success: false, message: 'Erreur serveur.' })
  }
})

module.exports = router
