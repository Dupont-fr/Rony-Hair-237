const express = require('express')
const router = express.Router()
const Analytics = require('../models/Analytics')
const Review = require('../models/Review')
const Promotion = require('../models/Promotion')
const { verifyAdmin } = require('../utils/adminAuth')

// @route   GET /api/admin/analytics/dashboard
// @desc    Obtenir les stats dashboard avec période variable
// @access  Private (Admin)
router.get('/dashboard', verifyAdmin, async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30))

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const analytics = await Analytics.find({
      date: { $gte: startDate },
    })
      .sort({ date: 1 })
      .lean()

    const chartData = []
    const today = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const dayData = analytics.find(
        (a) => new Date(a.date).toDateString() === date.toDateString(),
      )

      chartData.push({
        date: date.toISOString().split('T')[0],
        visites: dayData?.visites || 0,
        commandes: dayData?.commandes || 0,
      })
    }

    const totalVisites = analytics.reduce((sum, a) => sum + a.visites, 0)
    const totalCommandes = analytics.reduce((sum, a) => sum + a.commandes, 0)

    const produitsMap = new Map()
    analytics.forEach((day) => {
      day.produits?.forEach((p) => {
        const current = produitsMap.get(p.produitId?.toString()) || {
          nom: p.nom,
          total: 0,
        }
        current.total += p.commandes
        produitsMap.set(p.produitId?.toString(), current)
      })
    })

    const topProduit = Array.from(produitsMap.values()).sort(
      (a, b) => b.total - a.total,
    )[0] || { nom: 'Aucun', total: 0 }

    const categoriesMap = new Map()
    analytics.forEach((day) => {
      day.categories?.forEach((c) => {
        const current = categoriesMap.get(c.categorieId?.toString()) || {
          nom: c.nom,
          total: 0,
        }
        current.total += c.commandes
        categoriesMap.set(c.categorieId?.toString(), current)
      })
    })

    const topCategorie = Array.from(categoriesMap.values()).sort(
      (a, b) => b.total - a.total,
    )[0] || { nom: 'Aucune', total: 0 }

    res.json({
      success: true,
      chartData,
      stats: {
        totalVisites,
        totalCommandes,
        topProduit,
        topCategorie,
      },
    })
  } catch (error) {
    console.error('Erreur analytics dashboard:', error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// @route   GET /api/admin/analytics/alerts
// @desc    Obtenir les alertes pour le dashboard
// @access  Private (Admin)
router.get('/alerts', verifyAdmin, async (req, res) => {
  try {
    const [pendingCount, promos] = await Promise.all([
      Review.countDocuments({ status: 'pending' }),
      Promotion.find({
        actif: true,
        dateFin: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })
        .select('nom dateFin')
        .lean(),
    ])

    res.json({
      success: true,
      pendingReviews: pendingCount,
      expiringPromotions: promos.map((p) => ({
        id: p._id,
        nom: p.nom,
        dateFin: p.dateFin,
      })),
    })
  } catch (error) {
    console.error('Erreur alerts:', error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// @route   GET /api/admin/analytics/heures
// @desc    Obtenir les visites par heure pour les N derniers jours
// @access  Private (Admin)
router.get('/heures', verifyAdmin, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30))
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const analytics = await Analytics.find({
      date: { $gte: startDate },
    })
      .select('date heures')
      .lean()

    const heuresData = []
    for (let h = 0; h < 24; h++) {
      heuresData.push({ heure: `${h}h`, visites: 0 })
    }

    let docsAvecHeures = 0
    analytics.forEach((day) => {
      if (Array.isArray(day.heures)) {
        docsAvecHeures++
        day.heures.forEach((h) => {
          if (h && typeof h.heure === 'number' && h.heure >= 0 && h.heure < 24) {
            heuresData[h.heure].visites += (typeof h.visites === 'number' ? h.visites : 0)
          }
        })
      }
    })

    console.log(`[heures] ${days}j: ${analytics.length} documents trouvés, ${docsAvecHeures} avec heures, total visites heures=${heuresData.reduce((s, h) => s + h.visites, 0)}`)

    res.json({ success: true, heures: heuresData })
  } catch (error) {
    console.error('Erreur analytics heures:', error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// @route   POST /api/admin/analytics/visite
// @desc    Enregistrer une visite (appelé depuis le frontend public)
// @access  Public
router.post('/visite', async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const currentHour = new Date().getHours()

    console.log(`[visite] Nouvelle visite - ${today.toISOString().split('T')[0]} à ${currentHour}h`)

    let analytics = await Analytics.findOne({ date: today })

    if (analytics) {
      analytics.visites += 1

      if (!Array.isArray(analytics.heures)) {
        console.log('[visite] Document existant sans heures ou mauvais format -> initialisation 24h')
        const heures = Array.from({ length: 24 }, (_, i) => ({
          heure: i,
          visites: i === currentHour ? 1 : 0,
        }))
        analytics.heures = heures
      } else {
        const heureIndex = analytics.heures.findIndex((h) => h.heure === currentHour)
        if (heureIndex >= 0) {
          analytics.heures[heureIndex].visites += 1
        } else {
          analytics.heures.push({ heure: currentHour, visites: 1 })
        }
      }

      await analytics.save()
      console.log(`[visite] sauvegardé: visites=${analytics.visites}, heures.length=${analytics.heures.length}, heure[${currentHour}].visites=${analytics.heures.find(h => h.heure === currentHour)?.visites}`)
    } else {
      console.log('[visite] Nouveau document avec tableau heures complet')
      const heures = Array.from({ length: 24 }, (_, i) => ({
        heure: i,
        visites: i === currentHour ? 1 : 0,
      }))

      await Analytics.create({
        date: today,
        visites: 1,
        heures,
      })
      console.log('[visite] Nouveau document créé avec 24 heures')
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Erreur enregistrement visite:', error)
    res.status(500).json({ success: false })
  }
})

// @route   POST /api/admin/analytics/commande
// @desc    Enregistrer une commande
// @access  Public
router.post('/commande', async (req, res) => {
  try {
    const { produitId, produitNom, categorieId, categorieNom } = req.body

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const analytics = await Analytics.findOne({ date: today })

    if (analytics) {
      analytics.commandes += 1

      const produitIndex = analytics.produits.findIndex(
        (p) => p.produitId?.toString() === produitId,
      )
      if (produitIndex >= 0) {
        analytics.produits[produitIndex].commandes += 1
      } else {
        analytics.produits.push({
          produitId,
          nom: produitNom,
          commandes: 1,
        })
      }

      const categorieIndex = analytics.categories.findIndex(
        (c) => c.categorieId?.toString() === categorieId,
      )
      if (categorieIndex >= 0) {
        analytics.categories[categorieIndex].commandes += 1
      } else {
        analytics.categories.push({
          categorieId,
          nom: categorieNom,
          commandes: 1,
        })
      }

      await analytics.save()
    } else {
      await Analytics.create({
        date: today,
        commandes: 1,
        produits: [{ produitId, nom: produitNom, commandes: 1 }],
        categories: [{ categorieId, nom: categorieNom, commandes: 1 }],
      })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Erreur enregistrement commande:', error)
    res.status(500).json({ success: false })
  }
})

module.exports = router
