// Textes de l'interface en français.
// Les variables entre accolades ({appName}, {email}…) sont remplacées par interpolate().
export const fr = {
  common: {
    defaultAppName: "Gestion sociale IA",
    toComplete: "[À compléter]",
    backToLogin: "Retour à la connexion",
  },
  metadata: {
    description: "Planifiez et publiez le contenu de vos clients sur les réseaux sociaux avec l'IA.",
  },
  auth: {
    loginTitle: "Connexion",
    loginDescription: "Accès réservé au propriétaire de l'application.",
    emailLabel: "Adresse courriel",
    passwordLabel: "Mot de passe",
    passwordSubmit: "Se connecter",
    magicLinkSubmit: "Recevoir un lien de connexion",
    or: "ou",
    pending: "Veuillez patienter…",
    magicLinkSent:
      "Si cette adresse est autorisée, un lien de connexion vient de lui être envoyé. Pensez à vérifier vos courriels indésirables.",
    errors: {
      invalidEmail: "Adresse courriel invalide.",
      passwordRequired: "Le mot de passe est requis.",
      invalidCredentials: "Adresse ou mot de passe incorrect.",
      forbidden: "Cette adresse n'est pas autorisée à se connecter.",
      linkInvalid: "Le lien de connexion est invalide ou expiré. Demandez-en un nouveau.",
      rateLimited: "Trop de tentatives. Réessayez dans quelques minutes.",
      unknown: "Une erreur est survenue. Réessayez.",
    },
    signOut: "Se déconnecter",
    signedInAs: "Connecté en tant que {email}",
  },
  nav: {
    dashboard: "Tableau de bord",
  },
  dashboard: {
    title: "Tableau de bord",
    empty: "Bienvenue ! Les clients et les publications apparaîtront ici.",
  },
  legal: {
    footerPrivacy: "Politique de confidentialité",
    footerTerms: "Conditions d'utilisation",
    footerDataDeletion: "Suppression des données",
    lastUpdated: "Dernière mise à jour : {date}",
    privacy: {
      title: "Politique de confidentialité",
      sections: [
        {
          heading: "1. Qui sommes-nous",
          paragraphs: [
            "{appName} est un outil interne exploité par {legalName}. Il sert à préparer, programmer et publier du contenu sur les comptes de réseaux sociaux (Facebook, Instagram, LinkedIn, X) des clients de {legalName}, avec l'autorisation explicite de ces derniers.",
            "L'application n'est pas ouverte au public : seule la personne responsable de {legalName} peut s'y connecter.",
          ],
        },
        {
          heading: "2. Renseignements recueillis",
          paragraphs: [
            "Compte du propriétaire : adresse courriel et données de connexion.",
            "Fiches clients : nom de la marque, secteur, description, ton, public cible, objectifs, produits ou services, mots-clés, mots-clics, exemples de publications, logo et couleurs.",
            "Comptes de réseaux sociaux connectés : identifiant et nom de la page ou du compte, jetons d'accès accordés par la plateforme lors de l'autorisation (OAuth), autorisations accordées et date d'expiration des jetons.",
            "Publications : textes, images, dates de publication, liens vers les publications en ligne et journaux techniques des tentatives de publication.",
            "Nous ne recueillons pas les renseignements des abonnés ou des visiteurs des pages des clients et nous n'accédons pas aux messages privés.",
          ],
        },
        {
          heading: "3. Utilisation des renseignements",
          paragraphs: [
            "Les renseignements servent uniquement à générer des propositions de contenu, à les faire valider et à les publier sur les comptes autorisés, aux dates choisies.",
            "Ils ne sont ni vendus, ni loués, ni utilisés à des fins publicitaires.",
          ],
        },
        {
          heading: "4. Communication à des fournisseurs",
          paragraphs: [
            "Pour fonctionner, l'application fait appel aux fournisseurs suivants : Vercel (hébergement), Supabase (base de données, authentification et stockage des fichiers), un fournisseur d'intelligence artificielle (OpenAI, Anthropic ou Google) qui reçoit le contenu de la fiche client pour rédiger les textes, ainsi que les plateformes de réseaux sociaux elles-mêmes (Meta, LinkedIn, X) lors de la publication.",
            "Ces fournisseurs peuvent traiter ou stocker des renseignements à l'extérieur du Canada, notamment aux États-Unis. Ils sont alors soumis aux lois de ces pays.",
          ],
        },
        {
          heading: "5. Conservation",
          paragraphs: [
            "Les jetons d'accès sont conservés tant que le compte reste connecté. Ils sont supprimés dès que le compte est déconnecté de l'application.",
            "Les fiches clients et les publications sont conservées pendant la durée de la relation d'affaires, puis supprimées sur demande ou au plus tard 30 jours après la fin de celle-ci.",
          ],
        },
        {
          heading: "6. Sécurité",
          paragraphs: [
            "Les jetons d'accès sont chiffrés dans la base de données (AES-256) et ne sont jamais transmis au navigateur. Les échanges avec les plateformes et les fournisseurs se font uniquement depuis le serveur, en connexion chiffrée (HTTPS). L'accès aux données est limité au propriétaire du compte.",
          ],
        },
        {
          heading: "7. Vos droits",
          paragraphs: [
            "Conformément à la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE), vous pouvez demander l'accès à vos renseignements, leur rectification ou leur suppression, et retirer votre consentement à tout moment, en écrivant à {contactEmail}. Nous répondons dans un délai de 30 jours.",
            "Vous pouvez aussi retirer l'accès de l'application directement depuis les paramètres de chaque plateforme : voir la page « Suppression des données ».",
          ],
        },
        {
          heading: "8. Modifications",
          paragraphs: [
            "Cette politique peut être mise à jour. La date de dernière mise à jour figure en haut de la page.",
          ],
        },
        {
          heading: "9. Contact",
          paragraphs: ["Responsable de la protection des renseignements : {legalName}, {contactEmail}."],
        },
      ],
    },
    terms: {
      title: "Conditions d'utilisation",
      sections: [
        {
          heading: "1. Objet",
          paragraphs: [
            "Les présentes conditions encadrent l'utilisation de {appName}, un outil exploité par {legalName} pour gérer la publication de contenu sur les réseaux sociaux de ses clients.",
          ],
        },
        {
          heading: "2. Accès",
          paragraphs: [
            "L'accès à l'application est réservé à {legalName}. Il n'existe pas d'inscription publique.",
          ],
        },
        {
          heading: "3. Autorisation des clients",
          paragraphs: [
            "Chaque client autorise expressément {legalName} à publier en son nom en connectant ses comptes ou en accordant un accès administrateur. Il peut retirer cette autorisation à tout moment depuis les paramètres de la plateforme concernée ou en écrivant à {contactEmail}.",
            "Le contenu est soumis au client pour validation avant d'être programmé.",
          ],
        },
        {
          heading: "4. Respect des règles des plateformes",
          paragraphs: [
            "L'utilisation de l'application respecte les conditions et les politiques de Meta (Facebook, Instagram), de LinkedIn et de X. Aucune publication automatisée contraire à ces règles n'est effectuée.",
          ],
        },
        {
          heading: "5. Contenu généré par intelligence artificielle",
          paragraphs: [
            "Les textes sont rédigés avec l'aide d'une intelligence artificielle, puis relus et validés par un humain avant publication.",
          ],
        },
        {
          heading: "6. Disponibilité et responsabilité",
          paragraphs: [
            "L'application dépend de services tiers (hébergement, plateformes de réseaux sociaux, fournisseurs d'IA). Une publication peut échouer ou être retardée en cas d'indisponibilité de l'un d'eux ; elle est alors signalée et peut être relancée manuellement. Dans la mesure permise par la loi, {legalName} ne peut être tenu responsable des dommages indirects liés à une telle indisponibilité.",
          ],
        },
        {
          heading: "7. Droit applicable",
          paragraphs: [
            "Les présentes conditions sont régies par les lois de la province de {province} et les lois fédérales du Canada qui s'y appliquent.",
          ],
        },
        {
          heading: "8. Contact",
          paragraphs: ["Pour toute question : {contactEmail}."],
        },
      ],
    },
    dataDeletion: {
      title: "Suppression des données",
      sections: [
        {
          heading: "Demander la suppression de vos données",
          paragraphs: [
            "Écrivez à {contactEmail} en indiquant le nom de votre entreprise et les comptes concernés. Nous supprimons vos jetons d'accès, votre fiche et vos publications dans un délai de 30 jours, et nous vous le confirmons par courriel.",
          ],
        },
        {
          heading: "Retirer l'accès depuis les plateformes",
          paragraphs: [
            "Facebook et Instagram : Paramètres et confidentialité › Paramètres › Intégrations professionnelles (ou Applications et sites web), puis retirez {appName}.",
            "LinkedIn : Préférences › Confidentialité des données › Services autorisés, puis retirez {appName}.",
            "X : Paramètres et confidentialité › Sécurité et accès au compte › Applications et sessions › Applications connectées, puis révoquez l'accès de {appName}.",
            "Dès que l'accès est retiré, l'application ne peut plus publier sur le compte. Les jetons devenus inutilisables sont ensuite supprimés.",
          ],
        },
      ],
    },
  },
} as const;
