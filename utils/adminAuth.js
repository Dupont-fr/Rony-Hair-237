const jwt = require('jsonwebtoken')
const Admin = require('../models/Admin')

exports.verifyAdmin = async (req, res, next) => {
  try {
    const token = req.cookies.token

    if (!token) {
      return res.status(401).json({ success: false, message: 'Accès non autorisé. Token manquant.' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Accès refusé. Droits administrateur requis.' })
    }

    const admin = await Admin.findById(decoded.id).select('-password')

    if (!admin || !admin.actif) {
      return res.status(401).json({ success: false, message: 'Compte administrateur introuvable ou désactivé.' })
    }

    req.admin = { id: admin._id, email: admin.email, role: admin.role }
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Token invalide.' })
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expirée. Veuillez vous reconnecter.' })
    }
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la vérification.' })
  }
}

exports.generateToken = (admin) => {
  return jwt.sign(
    { id: admin._id, email: admin.email, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' },
  )
}
