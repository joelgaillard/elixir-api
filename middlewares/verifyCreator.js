import Cocktail from '../models/cocktail.js';
import Bar from '../models/bar.js';

const verifyCreator = (type) => async (req, res, next) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const itemId = req.params.id;
  
  try {
    let item;
    if (type === 'cocktail') {
      item = await Cocktail.findById(itemId);
      if (!item) {
        return res.status(404).json({errors: [{ msg: "Cocktail non trouvé" }] });
      }
      // Vérifie si l'utilisateur est admin ou créateur du cocktail
      if (userRole !== 'admin' && item.createdBy.toString() !== userId) {
        return res.status(403).json({ 
          errors: [{ msg: "Accès refusé : vous n'êtes pas le créateur de ce cocktail" }] 
        });
      }
    } else if (type === 'bar') {
      item = await Bar.findById(itemId);
      if (!item) {
        return res.status(404).json({errors: [{ msg: "Bar non trouvé" }] });
      }
      // Vérifie si l'utilisateur est admin ou manager du bar
      if (userRole !== 'admin' && item.manager.toString() !== userId) {
        return res.status(403).json({ 
          errors: [{ msg: "Accès refusé : vous n'êtes pas le manager de ce bar" }] 
        });
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({ errors: [{ msg: "Erreur interne du serveur" }] });
  }
};

export default verifyCreator;