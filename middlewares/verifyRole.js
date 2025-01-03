function verifyRole(...allowedRoles) {
    return (req, res, next) => {
      const { role } = req.user; // `req.user` est défini par le middleware `verifyToken`
      
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ errors: [{ msg: "Accès refusé, rôle insuffisant." }] });
      }
      
      next();
    };
  }
  
  export default verifyRole;