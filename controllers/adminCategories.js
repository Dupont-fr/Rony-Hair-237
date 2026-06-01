const express = require('express')
const router = express.Router()
const Category = require('../models/Category')
const Image = require('../models/image')
const { verifyAdmin } = require('../utils/adminAuth')

router.get('/', verifyAdmin, async (req, res) => {
  try {
    const categories = await Category.find().sort({ ordre: 1, createdAt: -1 })
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const imageCount = await Image.countDocuments({ categorie: cat._id })
        return { ...cat.toObject(), nombreImages: imageCount }
      }),
    )
    res.json({ success: true, count: categories.length, categories: categoriesWithCount })
  } catch (error) {
    console.error('Erreur récupération catégories:', error)
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des catégories.' })
  }
})

router.get('/:id', verifyAdmin, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category) return res.status(404).json({ success: false, message: 'Catégorie introuvable.' })
    const imageCount = await Image.countDocuments({ categorie: req.params.id })
    res.json({ success: true, category: { ...category.toObject(), nombreImages: imageCount } })
  } catch (error) {
    console.error('Erreur récupération catégorie:', error)
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération.', error: error.message })
  }
})

router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { nom, ordre } = req.body
    if (!nom || nom.trim() === '') return res.status(400).json({ success: false, message: 'Le nom de la catégorie est requis.' })
    const existingCategory = await Category.findOne({ nom: { $regex: new RegExp(`^${nom.trim()}$`, 'i') } })
    if (existingCategory) return res.status(400).json({ success: false, message: 'Cette catégorie existe déjà.' })
    const category = await Category.create({ nom: nom.trim(), ordre: ordre || 0 })
    res.status(201).json({ success: true, message: 'Catégorie créée avec succès', category })
  } catch (error) {
    console.error('Erreur création catégorie:', error)
    res.status(500).json({ success: false, message: 'Erreur lors de la création de la catégorie.', error: error.message })
  }
})

router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { nom, description, ordre, actif } = req.body
    const category = await Category.findById(req.params.id)
    if (!category) return res.status(404).json({ success: false, message: 'Catégorie introuvable.' })
    if (nom && nom.trim()) category.nom = nom.trim()
    if (description !== undefined) category.description = description.trim()
    if (ordre !== undefined) category.ordre = ordre
    if (actif !== undefined) category.actif = actif
    await category.save()
    res.json({ success: true, message: 'Catégorie modifiée avec succès', category })
  } catch (error) {
    console.error('Erreur modification catégorie:', error)
    res.status(500).json({ success: false, message: 'Erreur lors de la modification.', error: error.message })
  }
})

router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category) return res.status(404).json({ success: false, message: 'Catégorie introuvable.' })
    const imageCount = await Image.countDocuments({ categorie: req.params.id })
    if (imageCount > 0) return res.status(400).json({ success: false, message: `Impossible de supprimer. Cette catégorie contient ${imageCount} image(s).`, imageCount })
    await category.deleteOne()
    res.json({ success: true, message: 'Catégorie supprimée avec succès' })
  } catch (error) {
    console.error('Erreur suppression catégorie:', error)
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression.', error: error.message })
  }
})

router.put('/images/:imageId', verifyAdmin, async (req, res) => {
  try {
    const { imageId } = req.params
    const updateData = req.body
    const allowedFields = ['nom', 'prix', 'devise', 'description', 'enStock', 'quantite', 'dimensions', 'materiau', 'ordre', 'actif']
    const filteredUpdate = {}
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) filteredUpdate[key] = updateData[key]
    }
    const image = await Image.findById(imageId)
    if (!image) return res.status(404).json({ success: false, message: 'Image non trouvée' })
    Object.assign(image, filteredUpdate)
    await image.save()
    res.json({ success: true, message: 'Image modifiée avec succès', image })
  } catch (error) {
    console.error('Erreur modification image:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

router.delete('/images/:imageId', verifyAdmin, async (req, res) => {
  try {
    const { imageId } = req.params
    const image = await Image.findById(imageId)
    if (!image) return res.status(404).json({ success: false, message: 'Image non trouvée' })
    await image.deleteOne()
    res.json({ success: true, message: 'Image supprimée avec succès' })
  } catch (error) {
    console.error('Erreur suppression image:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

module.exports = router
