const express = require('express')
const router = express.Router()
const Review = require('../models/Review')
const { verifyAdmin } = require('../utils/adminAuth')

const sanitize = (str) => str.replace(/<[^>]*>/g, '').trim()

// ============================================
// ROUTES PUBLIQUES
// ============================================

// @route   GET /api/reviews
// @desc    Récupérer les avis approuvés avec pagination
// @access  Public
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10))
    const skip = (page - 1) * limit

    const [reviews, totalReviews] = await Promise.all([
      Review.find({ status: 'approved' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments({ status: 'approved' }),
    ])

    const totalPages = Math.ceil(totalReviews / limit)

    res.json({
      success: true,
      count: reviews.length,
      totalReviews,
      totalPages,
      currentPage: page,
      reviews,
    })
  } catch (error) {
    console.error('Erreur récupération avis:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des avis',
    })
  }
})

// @route   POST /api/reviews
// @desc    Créer un nouvel avis
// @access  Public
router.post('/', async (req, res) => {
  try {
    const { visitorId, nom, prenom, message, note, photo } = req.body

    const cleanNom = sanitize(nom)
    const cleanPrenom = sanitize(prenom)
    const cleanMessage = sanitize(message)
    const cleanNote = Math.min(5, Math.max(1, parseInt(note) || 5))

    // Validation
    if (!visitorId || !cleanNom || !cleanPrenom) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs obligatoires doivent être remplis',
      })
    }

    if (!cleanMessage || cleanMessage.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Le message doit contenir au moins 10 caractères',
      })
    }

    // Anti-spam : 1 minute entre deux avis du même visiteur
    const recentReview = await Review.findOne({
      visitorId,
      createdAt: { $gte: new Date(Date.now() - 60000) },
    })

    if (recentReview) {
      return res.status(429).json({
        success: false,
        message: 'Veuillez attendre 1 minute avant de poster un nouvel avis',
      })
    }

    // Générer un avatar si pas de photo fournie
    const reviewPhoto = photo && photo.trim() !== '' ? photo : `https://ui-avatars.com/api/?name=${cleanNom[0]}${cleanPrenom[0]}&background=8b5a2b&color=fff&size=200&bold=true`

    const review = await Review.create({
      visitorId,
      nom: cleanNom,
      prenom: cleanPrenom,
      note: cleanNote,
      photo: reviewPhoto,
      message: cleanMessage,
      status: 'pending',
      likes: 0,
      likedBy: [],
    })

    res.status(201).json({
      success: true,
      message: 'Avis soumis avec succès. Il sera publié après modération.',
      review,
    })
  } catch (error) {
    console.error('Erreur création avis:', error)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la création de l'avis",
      error: error.message,
    })
  }
})

// @route   PUT /api/reviews/:id
// @desc    Modifier un avis
// @access  Public (avec vérification visitorId)
router.put('/:id', async (req, res) => {
  try {
    const { visitorId, message, note } = req.body
    const review = await Review.findById(req.params.id)

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Avis introuvable',
      })
    }

    if (review.visitorId !== visitorId) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à modifier cet avis",
      })
    }

    if (message) {
      const clean = sanitize(message)
      if (clean.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Le message doit contenir au moins 10 caractères',
        })
      }
      review.message = clean
    }
    if (note !== undefined) {
      review.note = Math.min(5, Math.max(1, parseInt(note) || 5))
    }

    await review.save()

    res.json({
      success: true,
      message: 'Avis modifié avec succès',
      review,
    })
  } catch (error) {
    console.error('Erreur modification avis:', error)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la modification de l'avis",
      error: error.message,
    })
  }
})

// @route   DELETE /api/reviews/:id
// @desc    Supprimer un avis
// @access  Public (avec vérification visitorId)
router.delete('/:id', async (req, res) => {
  try {
    const { visitorId } = req.body
    const review = await Review.findById(req.params.id)

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Avis introuvable',
      })
    }

    if (review.visitorId !== visitorId) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à supprimer cet avis",
      })
    }

    await Review.findByIdAndDelete(req.params.id)

    res.json({
      success: true,
      message: 'Avis supprimé avec succès',
    })
  } catch (error) {
    console.error('Erreur suppression avis:', error)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression de l'avis",
      error: error.message,
    })
  }
})

// @route   POST /api/reviews/:id/like
// @desc    Liker/déliker un avis
// @access  Public
router.post('/:id/like', async (req, res) => {
  try {
    const { visitorId } = req.body
    const review = await Review.findById(req.params.id)

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Avis introuvable',
      })
    }

    const hasLiked = review.likedBy.includes(visitorId)

    if (hasLiked) {
      review.likedBy = review.likedBy.filter((id) => id !== visitorId)
      review.likes = Math.max(0, review.likes - 1)
    } else {
      review.likedBy.push(visitorId)
      review.likes += 1
    }

    await review.save()

    res.json({
      success: true,
      message: hasLiked ? 'Like retiré' : 'Avis liké',
      liked: !hasLiked,
      review,
    })
  } catch (error) {
    console.error('Erreur like avis:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur lors du like',
      error: error.message,
    })
  }
})

// ============================================
// ROUTES ADMIN (protégées)
// ============================================

// @route   GET /api/reviews/admin
// @desc    Récupérer tous les avis (pour modération)
// @access  Admin
router.get('/admin/all', verifyAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query
    const filter = {}
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(50, Math.max(1, parseInt(limit)))

    const [reviews, total] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Math.min(50, Math.max(1, parseInt(limit)))),
      Review.countDocuments(filter),
    ])

    res.json({
      success: true,
      count: reviews.length,
      total,
      totalPages: Math.ceil(total / Math.min(50, Math.max(1, parseInt(limit)))),
      currentPage: Math.max(1, parseInt(page)),
      reviews,
    })
  } catch (error) {
    console.error('Erreur récupération avis admin:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des avis',
    })
  }
})

// @route   PUT /api/reviews/admin/:id
// @desc    Approuver/rejeter un avis
// @access  Admin
router.put('/admin/:id', verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide. Utilisez pending, approved ou rejected.',
      })
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    )

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Avis introuvable',
      })
    }

    res.json({
      success: true,
      message: `Avis ${status === 'approved' ? 'approuvé' : status === 'rejected' ? 'rejeté' : 'remis en attente'}`,
      review,
    })
  } catch (error) {
    console.error('Erreur modération avis:', error)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la modération de l'avis",
    })
  }
})

// @route   DELETE /api/reviews/admin/:id
// @desc    Supprimer un avis (admin)
// @access  Admin
router.delete('/admin/:id', verifyAdmin, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id)

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Avis introuvable',
      })
    }

    res.json({
      success: true,
      message: 'Avis supprimé avec succès',
    })
  } catch (error) {
    console.error('Erreur suppression avis admin:', error)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression de l'avis",
    })
  }
})

module.exports = router
