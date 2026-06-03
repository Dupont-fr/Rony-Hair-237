const express = require('express')
const router = express.Router()
const Promotion = require('../models/Promotion')

// ============================================
// ROUTES PUBLIQUES - PROMOTIONS
// ============================================

// @route   GET /api/promotions/active
// @desc    Obtenir toutes les promotions actives
// @access  Public
router.get('/active', async (req, res) => {
  try {
    const now = new Date()

    // Auto-désactiver les promos expirées
    await Promotion.updateMany(
      { actif: true, dateFin: { $lt: now } },
      { $set: { actif: false } },
    )

    // Récupérer toutes les promotions actives dans la période
    const promotions = await Promotion.find({
      actif: true,
      dateDebut: { $lte: new Date(Date.now() + 30 * 60 * 1000) },
      dateFin: { $gte: now },
    })
      .populate('categorie', 'nom slug')
      .select('type nom description image dateDebut dateFin categorie gains dureeAffichage')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      count: promotions.length,
      promotions,
    })
  } catch (error) {
    console.error('Erreur récupération promotions actives:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des promotions.',
    })
  }
})

// @route   GET /api/promotions/category/:categoryId
// @desc    Obtenir la promotion active pour une catégorie spécifique
// @access  Public
router.get('/category/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params
    const now = new Date()

    // Auto-désactiver les promos expirées
    await Promotion.updateMany(
      { actif: true, dateFin: { $lt: now } },
      { $set: { actif: false } },
    )

    const promotion = await Promotion.findOne({
      type: 'stock-limite',
      categorie: categoryId,
      actif: true,
      dateDebut: { $lte: new Date(Date.now() + 30 * 60 * 1000) },
      dateFin: { $gte: now },
    }).select('type nom description image dateDebut dateFin')

    if (!promotion) {
      return res.json({
        success: true,
        promotion: null,
      })
    }

    res.json({
      success: true,
      promotion,
    })
  } catch (error) {
    console.error('Erreur récupération promotion catégorie:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération.',
    })
  }
})

// @route   GET /api/promotions/tombola
// @desc    Obtenir les promotions tombola actives
// @access  Public
router.get('/tombola', async (req, res) => {
  try {
    const now = new Date()

    // Auto-désactiver les promos expirées
    await Promotion.updateMany(
      { actif: true, dateFin: { $lt: now } },
      { $set: { actif: false } },
    )

    const promotions = await Promotion.find({
      type: 'tombola',
      actif: true,
      dateDebut: { $lte: new Date(Date.now() + 30 * 60 * 1000) },
      dateFin: { $gte: now },
    })
      .select('nom description image dateDebut dateFin gains dureeAffichage')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      count: promotions.length,
      promotions,
    })
  } catch (error) {
    console.error('Erreur récupération tombola:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération.',
    })
  }
})

module.exports = router
