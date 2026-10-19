/** Shared interface words: actions, states, content kinds, and topics. */
import type { Catalog } from "./types";

export const commonStrings = {
  "common.retry": { en: "Retry", es: "Reintentar", zh: "重试" },
  "common.tryAgain": {
    en: "Try again",
    es: "Intentar de nuevo",
    zh: "再试一次",
  },
  "common.loading": { en: "Loading…", es: "Cargando…", zh: "正在加载…" },
  "common.cancel": { en: "Cancel", es: "Cancelar", zh: "取消" },
  "common.close": { en: "Close", es: "Cerrar", zh: "关闭" },
  "common.back": { en: "Back", es: "Atrás", zh: "返回" },
  "common.goBack": { en: "Go back", es: "Volver", zh: "返回" },
  "common.done": { en: "Done", es: "Listo", zh: "完成" },
  "common.save": { en: "Save", es: "Guardar", zh: "保存" },
  "common.saving": { en: "Saving…", es: "Guardando…", zh: "正在保存…" },
  "common.remove": { en: "Remove", es: "Quitar", zh: "移除" },
  "common.share": { en: "Share", es: "Compartir", zh: "分享" },
  "common.open": { en: "Open", es: "Abrir", zh: "打开" },
  "common.openSource": {
    en: "Open source",
    es: "Abrir fuente",
    zh: "打开来源",
  },
  "common.sources": { en: "Sources", es: "Fuentes", zh: "来源" },
  "common.source": { en: "Source", es: "Fuente", zh: "来源" },
  "common.continue": { en: "Continue", es: "Continuar", zh: "继续" },
  "common.next": { en: "Next", es: "Siguiente", zh: "下一步" },
  "common.skip": { en: "Skip", es: "Omitir", zh: "跳过" },
  "common.edit": { en: "Edit", es: "Editar", zh: "编辑" },
  "common.change": { en: "Change", es: "Cambiar", zh: "更改" },
  "common.clear": { en: "Clear", es: "Borrar", zh: "清除" },
  "common.showMore": { en: "Show more", es: "Mostrar más", zh: "显示更多" },
  "common.showLess": { en: "Show less", es: "Mostrar menos", zh: "收起" },
  "common.seeAll": { en: "See all", es: "Ver todo", zh: "查看全部" },
  "common.viewAll": { en: "View all", es: "Ver todo", zh: "查看全部" },
  "common.learnMore": {
    en: "Learn more",
    es: "Más información",
    zh: "了解更多",
  },
  "common.or": { en: "or", es: "o", zh: "或" },
  "common.and": { en: "and", es: "y", zh: "和" },
  "common.yes": { en: "Yes", es: "Sí", zh: "是" },
  "common.no": { en: "No", es: "No", zh: "否" },
  "common.on": { en: "On", es: "Activado", zh: "开" },
  "common.off": { en: "Off", es: "Desactivado", zh: "关" },
  "common.today": { en: "Today", es: "Hoy", zh: "今天" },
  "common.tomorrow": { en: "Tomorrow", es: "Mañana", zh: "明天" },
  "common.yesterday": { en: "Yesterday", es: "Ayer", zh: "昨天" },
  "common.unknown": { en: "Unknown", es: "Desconocido", zh: "未知" },
  "common.notAvailable": {
    en: "Not available",
    es: "No disponible",
    zh: "暂无",
  },
  "common.didntLoad": { en: "Didn’t load", es: "No se cargó", zh: "未能加载" },
  "common.couldNotLoad": {
    en: "Could not load this.",
    es: "No se pudo cargar.",
    zh: "无法加载。",
  },
  "common.somethingWrong": {
    en: "Something went wrong",
    es: "Algo salió mal",
    zh: "出了点问题",
  },
  "common.checkConnection": {
    en: "Check your connection and try again.",
    es: "Revisa tu conexión e inténtalo de nuevo.",
    zh: "请检查网络连接后重试。",
  },
  "common.opensInBrowser": {
    en: "Opens in your browser",
    es: "Se abre en tu navegador",
    zh: "在浏览器中打开",
  },
  "common.official": { en: "Official", es: "Oficial", zh: "官方" },
  "common.updated": {
    en: "Updated {date}",
    es: "Actualizado el {date}",
    zh: "更新于 {date}",
  },
  "common.listSeparator": { en: " · ", es: " · ", zh: " · " },
  "common.originalLanguageNote": {
    en: "Names, places, dates, and official text appear as published.",
    es: "Los nombres, lugares, fechas y textos oficiales aparecen tal como se publicaron.",
    zh: "姓名、地点、日期和官方文本均按发布原样显示。",
  },
  "common.sourceEnglishNote": {
    en: "Official and source text stays in its original language.",
    es: "El texto oficial y de las fuentes se mantiene en su idioma original.",
    zh: "官方文本和来源文本保留原文。",
  },

  "contentType.bill": { en: "Bill", es: "Proyecto de ley", zh: "法案" },
  "contentType.exec": { en: "Executive", es: "Ejecutivo", zh: "行政文件" },
  "contentType.court": { en: "Case", es: "Caso", zh: "案件" },
  "contentType.news": { en: "News", es: "Noticias", zh: "新闻" },
  "contentType.local": { en: "Local", es: "Local", zh: "地方" },

  "governmentContent.ORDER": {
    en: "Order",
    es: "Orden ejecutiva",
    zh: "行政令",
  },
  "governmentContent.NOTICE": { en: "Notice", es: "Aviso", zh: "通知" },
  "governmentContent.MEMORANDUM": {
    en: "Memorandum",
    es: "Memorando",
    zh: "备忘录",
  },
  "governmentContent.PROCLAMATION": {
    en: "Proclamation",
    es: "Proclamación",
    zh: "公告",
  },
  "governmentContent.PRESIDENTIAL DOCUMENT": {
    en: "Presidential document",
    es: "Documento presidencial",
    zh: "总统文件",
  },
  "governmentContent.NEWS ARTICLE": {
    en: "News article",
    es: "Artículo de noticias",
    zh: "新闻报道",
  },
  "governmentContent.FACT SHEET": {
    en: "Fact sheet",
    es: "Hoja informativa",
    zh: "情况说明",
  },
  "governmentContent.PRESS RELEASE": {
    en: "Press release",
    es: "Comunicado de prensa",
    zh: "新闻稿",
  },
  "governmentContent.BRIEFING STATEMENT": {
    en: "Briefing statement",
    es: "Declaración informativa",
    zh: "简报声明",
  },
  "governmentContent.PRESIDENTIAL ACTION": {
    en: "Presidential action",
    es: "Acción presidencial",
    zh: "总统行动",
  },
  "governmentContent.EXECUTIVE": {
    en: "Executive",
    es: "Ejecutivo",
    zh: "行政文件",
  },

  "follow.saveTitle": {
    en: "Save {title} for later",
    es: "Guardar {title} para después",
    zh: "保存“{title}”以便稍后阅读",
  },
  "follow.removeTitle": {
    en: "Remove {title} from saved",
    es: "Quitar {title} de guardados",
    zh: "从已保存中移除“{title}”",
  },
  "follow.saveBill": {
    en: "Save this bill for later",
    es: "Guardar este proyecto de ley para después",
    zh: "保存此法案以便稍后阅读",
  },
  "follow.saveCase": {
    en: "Save this case for later",
    es: "Guardar este caso para después",
    zh: "保存此案件以便稍后阅读",
  },
  "follow.saveOrder": {
    en: "Save this order for later",
    es: "Guardar esta orden para después",
    zh: "保存此行政令以便稍后阅读",
  },
  "follow.saveRecord": {
    en: "Save this record for later",
    es: "Guardar este registro para después",
    zh: "保存此记录以便稍后阅读",
  },
  "follow.removeBill": {
    en: "Remove this bill from saved",
    es: "Quitar este proyecto de ley de guardados",
    zh: "从已保存中移除此法案",
  },
  "follow.removeCase": {
    en: "Remove this case from saved",
    es: "Quitar este caso de guardados",
    zh: "从已保存中移除此案件",
  },
  "follow.removeOrder": {
    en: "Remove this order from saved",
    es: "Quitar esta orden de guardados",
    zh: "从已保存中移除此行政令",
  },
  "follow.removeRecord": {
    en: "Remove this record from saved",
    es: "Quitar este registro de guardados",
    zh: "从已保存中移除此记录",
  },

  "relative.today": { en: "today", es: "hoy", zh: "今天" },
  "relative.daysAgo": {
    en: { one: "{count} day ago", other: "{count} days ago" },
    es: { one: "hace {count} día", other: "hace {count} días" },
    zh: "{count} 天前",
  },
  "relative.inDays": {
    en: { one: "in {count} day", other: "in {count} days" },
    es: { one: "en {count} día", other: "en {count} días" },
    zh: "{count} 天后",
  },
  "relative.daysLeft": {
    en: { one: "{count} day left", other: "{count} days left" },
    es: { one: "Queda {count} día", other: "Quedan {count} días" },
    zh: "还剩 {count} 天",
  },

  "topic.Healthcare": { en: "Healthcare", es: "Salud", zh: "医疗" },
  "topic.Climate": { en: "Climate", es: "Clima", zh: "气候" },
  "topic.Economy": { en: "Economy", es: "Economía", zh: "经济" },
  "topic.Civil rights": {
    en: "Civil rights",
    es: "Derechos civiles",
    zh: "民权",
  },
  "topic.Technology": { en: "Technology", es: "Tecnología", zh: "科技" },
  "topic.Education": { en: "Education", es: "Educación", zh: "教育" },
  "topic.Immigration": { en: "Immigration", es: "Inmigración", zh: "移民" },
  "topic.Foreign policy": {
    en: "Foreign policy",
    es: "Política exterior",
    zh: "外交政策",
  },
  "topic.Housing": { en: "Housing", es: "Vivienda", zh: "住房" },
  "topic.Criminal justice": {
    en: "Criminal justice",
    es: "Justicia penal",
    zh: "刑事司法",
  },
  "topic.Labor": { en: "Labor", es: "Trabajo", zh: "劳工" },
  "topic.Elections": { en: "Elections", es: "Elecciones", zh: "选举" },

  // Governments Billion covers. Place names are interface copy here, not
  // source text: they label scope, never quote a record.
  "place.federal.name": {
    en: "United States",
    es: "Estados Unidos",
    zh: "美国",
  },
  "place.federal.body": {
    en: "United States Congress",
    es: "Congreso de los Estados Unidos",
    zh: "美国国会",
  },
  "place.federal.description": {
    en: "Congress, the President, the Supreme Court",
    es: "El Congreso, el presidente y la Corte Suprema",
    zh: "国会、总统和最高法院",
  },
  "place.ca.name": { en: "California", es: "California", zh: "加利福尼亚州" },
  "place.ca.body": {
    en: "California State Legislature",
    es: "Legislatura del Estado de California",
    zh: "加利福尼亚州议会",
  },
  "place.ca.description": {
    en: "State Legislature · 2025–2026 regular session",
    es: "Legislatura estatal · sesión ordinaria 2025–2026",
    zh: "州议会 · 2025–2026 年例会",
  },
  "place.ma.name": {
    en: "Massachusetts",
    es: "Massachusetts",
    zh: "马萨诸塞州",
  },
  "place.ma.body": {
    en: "Massachusetts General Court",
    es: "Tribunal General de Massachusetts (legislatura)",
    zh: "马萨诸塞州议会",
  },
  "place.ma.description": {
    en: "Legislation and district court criminal dockets",
    es: "Legislación y expedientes penales de los tribunales de distrito",
    zh: "立法及地区法院刑事案件记录",
  },
  "place.mo.name": { en: "Missouri", es: "Misuri", zh: "密苏里州" },
  "place.mo.body": {
    en: "Missouri General Assembly",
    es: "Asamblea General de Misuri",
    zh: "密苏里州议会",
  },
  "place.mo.description": {
    en: "General Assembly · 2026 regular session",
    es: "Asamblea General · sesión ordinaria 2026",
    zh: "州议会 · 2026 年例会",
  },
  "place.nc.name": {
    en: "North Carolina",
    es: "Carolina del Norte",
    zh: "北卡罗来纳州",
  },
  "place.nc.body": {
    en: "North Carolina General Assembly",
    es: "Asamblea General de Carolina del Norte",
    zh: "北卡罗来纳州议会",
  },
  "place.nc.description": {
    en: "General Assembly · 2025–2026 regular session",
    es: "Asamblea General · sesión ordinaria 2025–2026",
    zh: "州议会 · 2025–2026 年例会",
  },
  "place.tx.name": { en: "Texas", es: "Texas", zh: "得克萨斯州" },
  "place.tx.body": {
    en: "Texas Legislature",
    es: "Legislatura de Texas",
    zh: "得克萨斯州议会",
  },
  "place.tx.description": {
    en: "State Legislature · 89th Legislature",
    es: "Legislatura estatal · 89.ª Legislatura",
    zh: "州议会 · 第 89 届议会",
  },

  "jurisdictionPicker.scopeA11y": {
    en: "Jurisdiction: {body}. Change jurisdiction",
    es: "Jurisdicción: {body}. Cambiar jurisdicción",
    zh: "辖区：{body}。更改辖区",
  },
  "jurisdictionPicker.close": {
    en: "Close jurisdiction picker",
    es: "Cerrar el selector de jurisdicción",
    zh: "关闭辖区选择器",
  },
  "jurisdictionPicker.title": {
    en: "Jurisdiction",
    es: "Jurisdicción",
    zh: "辖区",
  },
  "jurisdictionPicker.intro": {
    en: "Search and results follow this government.",
    es: "La búsqueda y los resultados siguen a este gobierno.",
    zh: "搜索和结果将以此政府为准。",
  },
  "jurisdictionPicker.federal": { en: "Federal", es: "Federal", zh: "联邦" },
  "jurisdictionPicker.states": { en: "States", es: "Estados", zh: "州" },
  "jurisdictionPicker.yourState": {
    en: "your state",
    es: "tu estado",
    zh: "你所在的州",
  },
  "jurisdictionPicker.coverage": {
    en: "State bill coverage currently includes California, North Carolina and Texas.",
    es: "La cobertura de proyectos de ley estatales incluye actualmente California, Carolina del Norte y Texas.",
    zh: "目前收录的州法案涵盖加利福尼亚州、北卡罗来纳州和得克萨斯州。",
  },

  "address.defaultHint": {
    en: "Enter your address to see what's on your ballot.",
    es: "Escribe tu dirección para ver qué hay en tu boleta.",
    zh: "输入你的地址，查看你的选票上有哪些内容。",
  },
  "address.confirming": {
    en: "Finding the street address…",
    es: "Buscando la dirección postal…",
    zh: "正在查找街道地址…",
  },
  "address.checkDraft": {
    en: "Filled in from your location. Check it, then tap {action}.",
    es: "Completada con tu ubicación. Revísala y luego toca {action}.",
    zh: "已根据你的位置填写。请核对后点按“{action}”。",
  },
  "address.searching": { en: "Searching…", es: "Buscando…", zh: "正在搜索…" },
  "address.placeholder": { en: "Address", es: "Dirección", zh: "地址" },
  "address.registeredPlaceholder": {
    en: "Registered address",
    es: "Dirección de registro",
    zh: "登记地址",
  },
  "address.lookUp": { en: "Look Up", es: "Buscar", zh: "查询" },
  "address.change": {
    en: "Change address",
    es: "Cambiar dirección",
    zh: "更改地址",
  },
  "address.set": {
    en: "Set address",
    es: "Agregar dirección",
    zh: "设置地址",
  },
  "address.clear": {
    en: "Clear saved address",
    es: "Borrar la dirección guardada",
    zh: "清除已保存的地址",
  },

  "account.title": { en: "Account", es: "Cuenta", zh: "账户" },
  "account.markA11y": {
    en: "Account: {name}. Open feedback and settings",
    es: "Cuenta: {name}. Abrir comentarios y ajustes",
    zh: "账户：{name}。打开反馈和设置",
  },
  "account.markA11yAnon": {
    en: "Account. Open feedback and settings",
    es: "Cuenta. Abrir comentarios y ajustes",
    zh: "账户。打开反馈和设置",
  },
  "account.closeMenu": {
    en: "Close profile menu",
    es: "Cerrar el menú de perfil",
    zh: "关闭个人菜单",
  },
  "account.sendFeedback": {
    en: "Send feedback",
    es: "Enviar comentarios",
    zh: "发送反馈",
  },
  "account.feedback": { en: "Feedback", es: "Comentarios", zh: "反馈" },
  "account.openSettings": {
    en: "Open settings",
    es: "Abrir ajustes",
    zh: "打开设置",
  },
  "account.settings": { en: "Settings", es: "Ajustes", zh: "设置" },

  "share.heading": {
    en: "Send this to someone",
    es: "Envíaselo a alguien",
    zh: "发送给别人",
  },
  "share.subheading": {
    en: "They can read the whole brief without installing anything.",
    es: "Puede leer el resumen completo sin instalar nada.",
    zh: "对方无需安装任何应用即可阅读完整简报。",
  },
  "share.dismiss": { en: "Dismiss", es: "Cerrar", zh: "关闭" },
  "share.link": {
    en: "Share the link",
    es: "Compartir el enlace",
    zh: "分享链接",
  },
  "share.linkHint": {
    en: "Opens a readable page — no app needed",
    es: "Abre una página para leer, sin necesidad de la app",
    zh: "打开可直接阅读的网页，无需应用",
  },
  "share.image": {
    en: "Share as an image",
    es: "Compartir como imagen",
    zh: "以图片分享",
  },
  "share.imageHint": {
    en: "Sized for a story or a post",
    es: "Del tamaño de una historia o una publicación",
    zh: "适合快拍或帖子的尺寸",
  },
  "share.instagram": {
    en: "Instagram Story",
    es: "Historia de Instagram",
    zh: "Instagram 快拍",
  },
  "share.instagramHint": {
    en: "Opens the Instagram story composer",
    es: "Abre el editor de historias de Instagram",
    zh: "打开 Instagram 快拍编辑器",
  },
  "share.notNow": { en: "Not now", es: "Ahora no", zh: "以后再说" },
  "share.dialogTitle": {
    en: "Share this brief",
    es: "Compartir este resumen",
    zh: "分享此简报",
  },

  "error.title": {
    en: "Something went wrong",
    es: "Algo salió mal",
    zh: "出了点问题",
  },
  "error.body": {
    en: "This screen couldn't be displayed. The problem has been reported.",
    es: "No se pudo mostrar esta pantalla. Ya informamos del problema.",
    zh: "无法显示此页面。问题已上报。",
  },
  "notFound.title": { en: "Oops!", es: "¡Uy!", zh: "哎呀！" },
  "notFound.body": {
    en: "This screen doesn't exist.",
    es: "Esta pantalla no existe.",
    zh: "此页面不存在。",
  },
  "notFound.home": {
    en: "Go to home screen!",
    es: "Ir a la pantalla de inicio",
    zh: "返回首页",
  },
  "dev.modalTitle": { en: "Modal", es: "Ventana modal", zh: "弹窗" },
  "dev.openCode": {
    en: "Open up the code for this screen:",
    es: "Abre el código de esta pantalla:",
    zh: "打开此页面的代码：",
  },
  "dev.changeText": {
    en: "Change any of the text, save the file, and your app will automatically update.",
    es: "Cambia cualquier texto, guarda el archivo y la app se actualizará automáticamente.",
    zh: "修改任意文本并保存文件，应用会自动更新。",
  },
  "dev.tapHere": {
    en: "Tap here if your app doesn't automatically update after making changes",
    es: "Toca aquí si la app no se actualiza automáticamente después de hacer cambios",
    zh: "如果修改后应用没有自动更新，请点按这里",
  },

  "aiDisclaimer.body": {
    en: "AI summary provided for convenience. Always review original sources for complete accuracy.",
    es: "Resumen generado con IA para tu comodidad. Consulta siempre las fuentes originales para mayor exactitud.",
    zh: "AI 摘要仅供参考。如需完整准确的信息，请务必查阅原始来源。",
  },
  "address.useLocation": {
    en: "Use my location",
    es: "Usar mi ubicación",
    zh: "使用我的位置",
  },
  "address.finding": {
    en: "Finding your location…",
    es: "Buscando tu ubicación…",
    zh: "正在查找你的位置…",
  },
  "address.denied": {
    en: "Location is off for Billion — type your registered address instead.",
    es: "La ubicación está desactivada para Billion. Escribe la dirección donde estás registrado para votar.",
    zh: "Billion 的定位权限已关闭，请输入你的选民登记地址。",
  },
  "address.unavailable": {
    en: "Location services are off — type your registered address instead.",
    es: "Los servicios de ubicación están desactivados. Escribe tu dirección de registro electoral.",
    zh: "定位服务已关闭，请输入你的选民登记地址。",
  },
  "address.failed": {
    en: "Couldn't get your location. Try again or type your registered address.",
    es: "No pudimos obtener tu ubicación. Inténtalo de nuevo o escribe tu dirección de registro electoral.",
    zh: "无法获取你的位置。请重试或输入你的选民登记地址。",
  },
  "address.noStreetAddress": {
    en: "Couldn't find a street address here. Type your registered address instead.",
    es: "No encontramos una dirección postal aquí. Escribe tu dirección de registro electoral.",
    zh: "无法找到此位置的街道地址，请输入你的选民登记地址。",
  },
  "address.news.denied": {
    en: "Location is off for Billion — type an address instead.",
    es: "La ubicación está desactivada para Billion. Escribe una dirección.",
    zh: "Billion 的定位权限已关闭，请手动输入地址。",
  },
  "address.news.unavailable": {
    en: "Location services are off — type an address instead.",
    es: "Los servicios de ubicación están desactivados. Escribe una dirección.",
    zh: "定位服务已关闭，请手动输入地址。",
  },
  "address.news.failed": {
    en: "Couldn't get your location. Try again or type an address.",
    es: "No pudimos obtener tu ubicación. Inténtalo de nuevo o escribe una dirección.",
    zh: "无法获取你的位置。请重试或手动输入地址。",
  },
  "address.news.noStreetAddress": {
    en: "Couldn't find a street address here. Type one instead.",
    es: "No encontramos una dirección postal aquí. Escribe una.",
    zh: "无法找到此位置的街道地址，请手动输入。",
  },
  "location.title": { en: "Location", es: "Ubicación", zh: "位置" },
  "location.change": {
    en: "Change address",
    es: "Cambiar dirección",
    zh: "更改地址",
  },
  "location.set": {
    en: "Add your address",
    es: "Agrega tu dirección",
    zh: "添加你的地址",
  },
  "location.registered": {
    en: "For local news and your ballot",
    es: "Para noticias locales y tu boleta",
    zh: "用于本地新闻和你的选票",
  },
  "location.intro": {
    en: "One saved address sets your local news and your ballot and representative lookups. For ballots, use the address where you’re registered to vote.",
    es: "Una dirección guardada define tus noticias locales y las consultas de tu boleta y tus representantes. Para la boleta, usa la dirección donde estás registrado para votar.",
    zh: "一个已保存的地址决定你的本地新闻，以及选票和议员查询。查询选票时，请使用你的选民登记地址。",
  },
  "location.kicker": {
    en: "YOUR SAVED ADDRESS",
    es: "TU DIRECCIÓN GUARDADA",
    zh: "你保存的地址",
  },
  "location.hint": {
    en: "Type an address, or use your location and check the result before saving.",
    es: "Escribe una dirección o usa tu ubicación y revisa el resultado antes de guardar.",
    zh: "输入地址，或使用定位并在保存前核对结果。",
  },
  "location.saved": {
    en: "Saved address",
    es: "Dirección guardada",
    zh: "已保存的地址",
  },
  "location.remove": {
    en: "Remove saved address",
    es: "Eliminar dirección guardada",
    zh: "删除已保存的地址",
  },
  "location.removeTitle": {
    en: "Remove saved address?",
    es: "¿Eliminar la dirección guardada?",
    zh: "删除已保存的地址？",
  },
  "location.removeBody": {
    en: "Ballot, voting, and representative lookups will ask for your address again until you set a new one.",
    es: "Las consultas de boletas, votación y representantes pedirán tu dirección de nuevo hasta que guardes otra.",
    zh: "在设置新地址之前，选票、投票和议员查询将再次要求输入地址。",
  },
  "location.removeAction": { en: "Remove", es: "Eliminar", zh: "删除" },
  "location.stored": {
    en: "Saved on this device. Billion never keeps your device’s coordinates. Change or remove the address at any time.",
    es: "Se guarda en este dispositivo. Billion nunca guarda las coordenadas de tu dispositivo. Cambia o elimina la dirección en cualquier momento.",
    zh: "保存在此设备上。Billion 绝不会保存设备坐标。你可以随时更改或删除该地址。",
  },
  "location.privacyLink": {
    en: "How Billion uses your address",
    es: "Cómo usa Billion tu dirección",
    zh: "Billion 如何使用你的地址",
  },
  "location.saveFailed": {
    en: "Couldn't save your address. Please try again.",
    es: "No pudimos guardar tu dirección. Inténtalo de nuevo.",
    zh: "无法保存你的地址，请重试。",
  },
  "location.removeFailed": {
    en: "Couldn't remove your address. Please try again.",
    es: "No pudimos eliminar tu dirección. Inténtalo de nuevo.",
    zh: "无法删除你的地址，请重试。",
  },
} satisfies Catalog;
