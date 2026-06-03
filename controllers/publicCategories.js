const express = require('express')
const router = express.Router()
const Category = require('../models/Category')
const Image = require('../models/image')
const Promotion = require('../models/Promotion')

router.get('/', async (req, res) => {
  try {
    const [categories, allImages, activePromotions] = await Promise.all([
      Category.find({ actif: true }).sort({ ordre: 1, nom: 1 }).select('nom slug ordre').lean(),
      Image.find({ actif: true })
        .sort({ ordre: 1, createdAt: -1 })
        .select('url nom prix devise description enStock quantite dimensions materiau ordre categorie')
        .lean(),
      Promotion.find({
        type: 'stock-limite',
        actif: true,
        dateDebut: { $lte: new Date(Date.now() + 30 * 60 * 1000) },
        dateFin: { $gte: new Date() },
      }).lean(),
    ])

    console.log('[publicCategories] Promotions trouvées:', activePromotions.length,
      activePromotions.map(p => ({ id: p._id, nom: p.nom, actif: p.actif, dateDebut: p.dateDebut, dateFin: p.dateFin, categorie: p.categorie?.toString() })))

    const imagesByCategory = {}
    allImages.forEach((img) => {
      const catId = img.categorie.toString()
      if (!imagesByCategory[catId]) imagesByCategory[catId] = []
      if (imagesByCategory[catId].length < 20) {
        imagesByCategory[catId].push(img)
      }
    })

    const promoByCategory = {}
    activePromotions.forEach((p) => {
      if (p.categorie) promoByCategory[p.categorie.toString()] = p
    })

    const categoriesWithContent = categories
      .map((cat) => {
        const catId = cat._id.toString()
        return {
          id: cat._id,
          nom: cat.nom,
          slug: cat.slug,
          ordre: cat.ordre,
          images: imagesByCategory[catId] || [],
          promotion: promoByCategory[catId] || null,
          nombreImages: (imagesByCategory[catId] || []).length,
        }
      })
      .filter((cat) => cat.images.length > 0)

    res.json({
      success: true,
      count: categoriesWithContent.length,
      categories: categoriesWithContent,
    })
  } catch (error) {
    console.error('Erreur récupération catégories publiques:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des catégories.',
    })
  }
})

router.get('/:slug', async (req, res) => {
  try {
    const category = await Category.findOne({
      slug: req.params.slug,
      actif: true,
    })

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie introuvable.',
      })
    }

    const images = await Image.find({
      categorie: category._id,
      actif: true,
    })
      .sort({ ordre: 1, createdAt: -1 })
      .select(
        'url nom prix devise description enStock quantite dimensions materiau ordre',
      )

    res.json({
      success: true,
      category: {
        id: category._id,
        nom: category.nom,
        slug: category.slug,
        images,
        nombreImages: images.length,
      },
    })
  } catch (error) {
    console.error('Erreur récupération catégorie publique:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération.',
    })
  }
})

module.exports = router
