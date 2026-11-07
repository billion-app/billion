/** The Elections tab, address ballot, results, representatives, and the process guide. */
import type { Catalog } from "./types";

export const electionStrings = {
  "Source dated {date}": {
    en: "Source dated {date}",
    es: "Fuente fechada el {date}",
    zh: "来源日期：{date}",
  },
  "Statements and campaign material": {
    en: "Statements and campaign material",
    es: "Declaraciones y material de campaña",
    zh: "候选人声明与竞选材料",
  },
  "Source passage": {
    en: "Source passage",
    es: "Pasaje de la fuente",
    zh: "来源原文",
  },
  "Attribution context": {
    en: "Attribution context",
    es: "Contexto de atribución",
    zh: "归属上下文",
  },
  "Published by {publisher}": {
    en: "Published by {publisher}",
    es: "Publicado por {publisher}",
    zh: "发布方：{publisher}",
  },
  "Speaker or author not established": {
    en: "Speaker or author not established",
    es: "No se ha determinado quién habla o escribe",
    zh: "尚未确定发言者或作者",
  },
  Reporting: {
    en: "Reporting",
    es: "Información periodística",
    zh: "新闻报道",
  },
  "Original record": {
    en: "Original record",
    es: "Registro original",
    zh: "原始记录",
  },
  "Candidate-related material": {
    en: "Candidate-related material",
    es: "Material sobre la candidatura",
    zh: "候选人相关材料",
  },
  "Campaign publication": {
    en: "Campaign publication",
    es: "Publicación de campaña",
    zh: "竞选团队发布的材料",
  },
  "Judicial background": {
    en: "Judicial background",
    es: "Trayectoria judicial",
    zh: "司法背景",
  },
  "Court authority": {
    en: "Court authority",
    es: "Facultades del tribunal",
    zh: "法院职权",
  },
  Considerations: {
    en: "Considerations",
    es: "Consideraciones",
    zh: "考量因素",
  },
  "Showing the last loaded results.": {
    en: "Showing the last loaded results.",
    es: "Se muestran los últimos resultados cargados.",
    zh: "正在显示上次加载的结果。",
  },
  "Local offices": {
    en: "Local offices",
    es: "Cargos locales",
    zh: "地方职位",
  },
  "Qualified write-in": {
    en: "Qualified write-in",
    es: "Candidatura por escrito habilitada",
    zh: "合格的手写候选人",
  },
  "Office counts follow the current search.": {
    en: "Office counts follow the current search.",
    es: "Los recuentos por cargo corresponden a la búsqueda actual.",
    zh: "各职位人数按当前搜索条件统计。",
  },
  "Couldn’t load this page.": {
    en: "Couldn’t load this page.",
    es: "No se pudo cargar esta página.",
    zh: "无法加载此页。",
  },
  "Showing the previous page.": {
    en: "Showing the previous page.",
    es: "Se muestra la página anterior.",
    zh: "正在显示上一页。",
  },
  "County and city offices": {
    en: "County and city offices",
    es: "Cargos de condados y ciudades",
    zh: "县市职位",
  },
  Previous: { en: "Previous", es: "Anterior", zh: "上一页" },
  Next: { en: "Next", es: "Siguiente", zh: "下一页" },
  "Roster retrieved {date}": {
    en: "Roster retrieved {date}",
    es: "Lista consultada el {date}",
    zh: "名册获取时间：{date}",
  },
  "State Assembly": {
    en: "State Assembly",
    es: "Asamblea estatal",
    zh: "州众议院",
  },
  "State Senate": { en: "State Senate", es: "Senado estatal", zh: "州参议院" },
  "U.S. House": {
    en: "U.S. House",
    es: "Cámara de Representantes de EE. UU.",
    zh: "美国众议院",
  },
  "Board of Equalization": {
    en: "Board of Equalization",
    es: "Junta de Igualación",
    zh: "税务平衡委员会",
  },
  "Statewide offices": {
    en: "Statewide offices",
    es: "Cargos estatales",
    zh: "全州职位",
  },
  "No reviewed judicial record sources are available yet.": {
    en: "No reviewed judicial record sources are available yet.",
    es: "Aún no hay fuentes revisadas sobre su historial judicial.",
    zh: "目前尚无经过审核的司法履历来源。",
  },
  "Reviewed research is not yet available for this candidate.": {
    en: "Reviewed research is not yet available for this candidate.",
    es: "Aún no hay investigación revisada para este candidato.",
    zh: "此候选人尚无可用的已审核研究。",
  },
  "Research not yet published": {
    en: "Research not yet published",
    es: "Investigación aún no publicada",
    zh: "研究尚未发布",
  },
  "Judicial record": {
    en: "Judicial record",
    es: "Historial judicial",
    zh: "司法履历",
  },
  "Judicial retention": {
    en: "Judicial retention",
    es: "Retención judicial",
    zh: "法官留任投票",
  },
  "Statewide, district and judicial contests.": {
    en: "Statewide, district and judicial contests.",
    es: "Contiendas estatales, de distrito y judiciales.",
    zh: "全州、选区和司法选举。",
  },
  "Browse the candidate roster": {
    en: "Browse the candidate roster",
    es: "Explorar la lista de candidatos",
    zh: "浏览候选人名册",
  },
  "Local coverage is partial. Check your official ballot.": {
    en: "Local coverage is partial. Check your official ballot.",
    es: "La cobertura local es parcial. Consulta tu boleta oficial.",
    zh: "地方选举覆盖不完整。请查看官方选票。",
  },
  "{count} candidates with reviewed research": {
    en: "{count} candidates with reviewed research",
    es: "{count} candidatos con investigación revisada",
    zh: "{count} 位候选人有已审核研究",
  },
  "{candidates} candidates · {contests} contests": {
    en: "{candidates} candidates · {contests} contests",
    es: "{candidates} candidatos · {contests} contiendas",
    zh: "{candidates} 位候选人 · {contests} 场选举",
  },
  "Number of candidates in each office group.": {
    en: "Number of candidates in each office group.",
    es: "Número de candidatos en cada grupo de cargos.",
    zh: "各职位类别的候选人数。",
  },
  "What this catalog covers": {
    en: "What this catalog covers",
    es: "Qué incluye este catálogo",
    zh: "本目录的覆盖范围",
  },
  "Check your official ballot for the contests you can vote in.": {
    en: "Check your official ballot for the contests you can vote in.",
    es: "Consulta tu boleta oficial para ver en qué contiendas puedes votar.",
    zh: "请查看官方选票，确认您可以投票的选举。",
  },
  "Try another name, office or district.": {
    en: "Try another name, office or district.",
    es: "Prueba otro nombre, cargo o distrito.",
    zh: "请尝试其他姓名、职位或选区。",
  },
  "No candidates match these filters.": {
    en: "No candidates match these filters.",
    es: "Ningún candidato coincide con estos filtros.",
    zh: "没有符合这些筛选条件的候选人。",
  },
  "Official roster only": {
    en: "Official roster only",
    es: "Solo lista oficial",
    zh: "仅有官方名册信息",
  },
  "Reviewed research": {
    en: "Reviewed research",
    es: "Investigación revisada",
    zh: "已审核研究",
  },
  "Alphabetical by name": {
    en: "Alphabetical by name",
    es: "Orden alfabético por nombre",
    zh: "按姓名字母排序",
  },
  "Candidates {start}–{end} of {total}": {
    en: "Candidates {start}–{end} of {total}",
    es: "Candidatos {start}–{end} de {total}",
    zh: "候选人第 {start}–{end} 位，共 {total} 位",
  },
  "Return to first page": {
    en: "Return to first page",
    es: "Volver a la primera página",
    zh: "返回第一页",
  },
  "Candidate catalog unavailable": {
    en: "Candidate catalog unavailable",
    es: "Catálogo de candidatos no disponible",
    zh: "候选人目录暂不可用",
  },
  "Loading candidates": {
    en: "Loading candidates",
    es: "Cargando candidatos",
    zh: "正在加载候选人",
  },
  "Clear search and filters": {
    en: "Clear search and filters",
    es: "Borrar búsqueda y filtros",
    zh: "清除搜索和筛选",
  },
  "Office: {office}": {
    en: "Office: {office}",
    es: "Cargo: {office}",
    zh: "职位：{office}",
  },
  "Name, office or district": {
    en: "Name, office or district",
    es: "Nombre, cargo o distrito",
    zh: "姓名、职位或选区",
  },
  "Coverage details": {
    en: "Coverage details",
    es: "Detalles de cobertura",
    zh: "覆盖范围详情",
  },
  "{listed} listed · {published} with reviewed research": {
    en: "{listed} listed · {published} with reviewed research",
    es: "{listed} en la lista · {published} con investigación revisada",
    zh: "名册共 {listed} 人 · {published} 人有已审核研究",
  },
  "California candidates": {
    en: "California candidates",
    es: "Candidatos de California",
    zh: "加州候选人",
  },
  "Show polls": { en: "Show polls", es: "Mostrar encuestas", zh: "显示民调" },
  "Polls are hidden until you choose to show them.": {
    en: "Polls are hidden until you choose to show them.",
    es: "Las encuestas se ocultan hasta que elijas verlas.",
    zh: "民调默认隐藏，选择后才会显示。",
  },
  "Checking polls…": {
    en: "Checking polls…",
    es: "Consultando encuestas…",
    zh: "正在查询民调…",
  },
  "Polling unavailable": {
    en: "Polling unavailable",
    es: "Encuestas no disponibles",
    zh: "无法获取民调",
  },
  "{rank} of {total}": {
    en: "{rank} of {total}",
    es: "{rank} de {total}",
    zh: "第 {rank} 名，共 {total} 名",
  },
  Candidates: { en: "Candidates", es: "Candidatos", zh: "候选人" },
  Governor: { en: "Governor", es: "Gobernador", zh: "州长" },
  "Governor poll": {
    en: "Governor poll",
    es: "Encuesta de gobernador",
    zh: "州长民调",
  },
  "Candidates in the official guide {count}": {
    en: "Candidates in the official guide {count}",
    es: "Candidatos en la guía oficial {count}",
    zh: "官方指南中的候选人 {count}",
  },
  "No poll available in our sources": {
    en: "No poll available in our sources",
    es: "No hay encuestas disponibles en nuestras fuentes",
    zh: "我们的来源暂无相关民调",
  },
  "Reported results": {
    en: "Reported results",
    es: "Resultados reportados",
    zh: "已报告结果",
  },
  Poll: { en: "Poll", es: "Encuesta", zh: "民调" },
  Close: { en: "Close", es: "Cerrar", zh: "关闭" },
  "Expand poll": {
    en: "Expand poll",
    es: "Ver encuesta",
    zh: "展开民调",
  },
  "Collapse poll": {
    en: "Collapse poll",
    es: "Ocultar encuesta",
    zh: "收起民调",
  },
  "Yes/No only": {
    en: "Yes/No only",
    es: "Solo Sí/No",
    zh: "仅含赞成／反对",
  },
  "Poll details": {
    en: "Poll details",
    es: "Detalles de la encuesta",
    zh: "民调详情",
  },
  "in this poll": {
    en: "in this poll",
    es: "en esta encuesta",
    zh: "在本次民调中",
  },
  Undecided: { en: "Undecided", es: "Indecisos", zh: "未决定" },
  Neither: { en: "Neither", es: "Ninguno", zh: "均不支持" },
  "Equal in this poll": {
    en: "Equal in this poll",
    es: "Iguales en esta encuesta",
    zh: "本次民调支持率相同",
  },
  "{name} ahead by {points} points in this poll": {
    en: "{name} ahead by {points} points in this poll",
    es: "{name} lleva {points} puntos de ventaja en esta encuesta",
    zh: "{name} 在本次民调中领先 {points} 个百分点",
  },
  "Not reported": { en: "Not reported", es: "No reportado", zh: "未报告" },
  Publisher: { en: "Publisher", es: "Editor", zh: "发布机构" },
  Pollster: { en: "Pollster", es: "Encuestadora", zh: "民调机构" },
  Sponsor: { en: "Sponsor", es: "Patrocinador", zh: "赞助方" },
  "Field dates": {
    en: "Field dates",
    es: "Fechas de entrevistas",
    zh: "调查日期",
  },
  Published: { en: "Published", es: "Publicación", zh: "发布日期" },
  Population: { en: "Population", es: "Población", zh: "调查对象" },
  "California statewide likely voters": {
    en: "California statewide likely voters",
    es: "Probables votantes de todo California",
    zh: "加州全州可能投票者",
  },
  "Question sample": {
    en: "Question sample",
    es: "Muestra de esta pregunta",
    zh: "本题样本数",
  },
  "Survey likely voters": {
    en: "Survey likely voters",
    es: "Probables votantes de la encuesta",
    zh: "调查中的可能投票者样本数",
  },
  "Survey margin of error": {
    en: "Survey margin of error",
    es: "Margen de error de la encuesta",
    zh: "调查误差范围",
  },
  "percentage points": {
    en: "percentage points",
    es: "puntos porcentuales",
    zh: "个百分点",
  },
  "Margin of error scope": {
    en: "Margin of error scope",
    es: "Alcance del margen de error",
    zh: "误差范围适用对象",
  },
  Method: { en: "Method", es: "Método", zh: "调查方法" },
  Question: { en: "Question", es: "Pregunta", zh: "题号" },
  "A poll measures opinions. It is not counted votes.": {
    en: "A poll measures opinions. It is not counted votes.",
    es: "Una encuesta mide opiniones. No son votos contados.",
    zh: "民调反映意见，并非已统计的选票。",
  },
  "Published percentages may total 99% or 101% because of rounding. Bars use the published values.":
    {
      en: "Published percentages may total 99% or 101% because of rounding. Bars use the published values.",
      es: "Los porcentajes publicados pueden sumar 99% o 101% por redondeo. Las barras usan los valores publicados.",
      zh: "由于四舍五入，公布的百分比合计可能为 99% 或 101%。条形图使用公布数值。",
    },
  "Read the poll source": {
    en: "Read the poll source",
    es: "Leer la fuente de la encuesta",
    zh: "阅读民调来源",
  },
  "Results pending": {
    en: "Results pending",
    es: "Resultados pendientes",
    zh: "结果待公布",
  },
  "Checking results…": {
    en: "Checking results…",
    es: "Consultando resultados…",
    zh: "正在查询结果…",
  },
  "Results unavailable": {
    en: "Results unavailable",
    es: "Resultados no disponibles",
    zh: "结果暂不可用",
  },
  "No votes counted yet": {
    en: "No votes counted yet",
    es: "Aún no se han contado votos",
    zh: "尚未计票",
  },
  "Yes is ahead": {
    en: "Yes is ahead",
    es: "El sí va adelante",
    zh: "赞成票领先",
  },
  "No is ahead": {
    en: "No is ahead",
    es: "El no va adelante",
    zh: "反对票领先",
  },
  Tied: { en: "Tied", es: "Empate", zh: "平票" },
  Leading: { en: "Leading", es: "En cabeza", zh: "领先" },
  "{count} votes": {
    en: "{count} votes",
    es: "{count} votos",
    zh: "{count} 票",
  },
  "Official election results": {
    en: "Official election results",
    es: "Resultados electorales oficiales",
    zh: "官方选举结果",
  },

  // Election types
  "elections.type.primary": { en: "Primary", es: "Primaria", zh: "初选" },
  "elections.type.general": { en: "General", es: "General", zh: "普选" },
  "elections.type.special": { en: "Special", es: "Especial", zh: "特别选举" },
  "elections.type.recall": { en: "Recall", es: "Revocatoria", zh: "罢免" },
  "elections.type.runoff": {
    en: "Runoff",
    es: "Segunda vuelta",
    zh: "决选",
  },
  "elections.type.other": { en: "Election", es: "Elección", zh: "选举" },

  // Contest fallbacks
  "elections.contestFallback": { en: "Contest", es: "Contienda", zh: "竞选" },
  "elections.mailBallot": {
    en: "Mail ballot",
    es: "Boleta por correo",
    zh: "邮寄选票",
  },
  "elections.electionDay": {
    en: "Election Day",
    es: "Día de la Elección",
    zh: "选举日",
  },

  // Elections tab
  "elections.tabTitle": { en: "Elections", es: "Elecciones", zh: "选举" },

  // Address-based ballot
  "elections.editAddressA11y": {
    en: "Edit registered address",
    es: "Editar la dirección registrada",
    zh: "编辑登记地址",
  },

  // Banner, calendar, address cluster
  "elections.banner.days": {
    en: { one: "{count} day", other: "{count} days" },
    es: { one: "{count} día", other: "{count} días" },
    zh: "{count} 天",
  },
  "elections.banner.until": {
    en: "until {election}",
    es: "para {election}",
    zh: "后举行 {election}",
  },
  "elections.banner.sub": {
    en: "Know what's on your ballot",
    es: "Conoce lo que hay en tu boleta",
    zh: "了解你选票上的内容",
  },
  "elections.banner.cta": {
    en: "See My Ballot",
    es: "Ver mi boleta",
    zh: "查看我的选票",
  },
  "elections.keyDates.calendar": {
    en: "Calendar",
    es: "Calendario",
    zh: "日程",
  },
  "elections.keyDates.registerBy": {
    en: "Register by",
    es: "Inscríbete antes del",
    zh: "登记截止",
  },
  "elections.keyDates.earlyVoting": {
    en: "Early voting",
    es: "Votación anticipada",
    zh: "提前投票",
  },
  "elections.keyDates.passed": { en: "Passed", es: "Pasó", zh: "已过" },
  "elections.keyDates.days": {
    en: { one: "{count} day", other: "{count} days" },
    es: { one: "{count} día", other: "{count} días" },
    zh: "{count} 天",
  },
  "elections.myBallot.address": { en: "Address", es: "Dirección", zh: "地址" },
  "elections.myBallot.whereYouVote": {
    en: "Where you vote",
    es: "Dónde votas",
    zh: "你的投票地点",
  },
  "elections.myBallot.fullBallot": {
    en: "Full ballot",
    es: "Boleta completa",
    zh: "完整选票",
  },

  // Live results
  "elections.results.live": {
    en: "Live results",
    es: "Resultados en vivo",
    zh: "实时结果",
  },
  "elections.results.title": { en: "Results", es: "Resultados", zh: "结果" },
  "elections.results.badge.primary": {
    en: "CA Primary",
    es: "Primaria de CA",
    zh: "加州初选",
  },
  "elections.results.badge.general": {
    en: "CA General",
    es: "General de CA",
    zh: "加州普选",
  },
  "elections.results.badge.special": {
    en: "CA Special",
    es: "Especial de CA",
    zh: "加州特别选举",
  },
  "elections.results.badge.other": {
    en: "CA Election",
    es: "Elección de CA",
    zh: "加州选举",
  },
  "elections.results.statewide": {
    en: "Statewide",
    es: "Estatal",
    zh: "全州",
  },
  "elections.results.district": {
    en: "Your district races",
    es: "Contiendas de tu distrito",
    zh: "你所在选区的竞选",
  },
  "elections.results.attribution": {
    en: "Source: California Secretary of State",
    es: "Fuente: Secretaría de Estado de California",
    zh: "来源：加州州务卿",
  },
  "elections.results.incumbent": {
    en: "INCUMBENT",
    es: "EN EL CARGO",
    zh: "现任",
  },
  "elections.results.advances": {
    en: "Advances",
    es: "Avanza",
    zh: "晋级",
  },
  "elections.results.votes": {
    en: { one: "{count} vote", other: "{count} votes" },
    es: { one: "{count} voto", other: "{count} votos" },
    zh: "{count} 票",
  },
  "elections.results.districtTitle": {
    en: "{chamber} · District {district}",
    es: "{chamber} · Distrito {district}",
    zh: "{chamber} · 第 {district} 选区",
  },
  "elections.results.reporting": {
    en: "{percent}% reporting · as of {asOf}",
    es: "{percent}% escrutado · al {asOf}",
    zh: "已统计 {percent}% · 截至 {asOf}",
  },
  "elections.results.asOf": {
    en: "As of {asOf}",
    es: "Al {asOf}",
    zh: "截至 {asOf}",
  },
  "elections.results.moreCandidates": {
    en: { one: "+{count} more candidate", other: "+{count} more candidates" },
    es: { one: "+{count} candidato más", other: "+{count} candidatos más" },
    zh: "另有 {count} 名候选人",
  },
  "elections.results.viewOfficial": {
    en: "View official results",
    es: "Ver resultados oficiales",
    zh: "查看官方结果",
  },
  "elections.chamber.us-house": {
    en: "U.S. House",
    es: "Cámara de Representantes de EE. UU.",
    zh: "美国众议院",
  },
  "elections.chamber.state-senate": {
    en: "State Senate",
    es: "Senado estatal",
    zh: "州参议院",
  },
  "elections.chamber.state-assembly": {
    en: "State Assembly",
    es: "Asamblea estatal",
    zh: "州众议会",
  },

  // Representatives
  "elections.reps.title": {
    en: "Representatives",
    es: "Representantes",
    zh: "民意代表",
  },
  "elections.reps.error": {
    en: "Couldn't load officials for this address.",
    es: "No se pudieron cargar los funcionarios de esta dirección.",
    zh: "无法加载此地址的官员信息。",
  },
  "elections.reps.source": {
    en: "Current legislator data: Open States",
    es: "Datos actuales de legisladores: Open States",
    zh: "现任议员数据：Open States",
  },
  "elections.reps.call": { en: "Call", es: "Llamar", zh: "致电" },
  "elections.reps.email": { en: "Email", es: "Correo", zh: "邮件" },
  "elections.reps.website": { en: "Website", es: "Sitio web", zh: "网站" },
  "elections.reps.callA11y": {
    en: "Call {name}",
    es: "Llamar a {name}",
    zh: "致电 {name}",
  },
  "elections.reps.emailA11y": {
    en: "Email {name}",
    es: "Enviar un correo a {name}",
    zh: "给 {name} 发邮件",
  },
  "elections.reps.websiteA11y": {
    en: "Open {name}'s website",
    es: "Abrir el sitio web de {name}",
    zh: "打开 {name} 的网站",
  },
  "All offices": {
    en: "All offices",
    es: "Todos los cargos",
    zh: "全部职位",
  },
  "Filter by office": {
    en: "Filter by office",
    es: "Filtrar por cargo",
    zh: "按职位筛选",
  },
  "Opens the candidate page": {
    en: "Opens the candidate page",
    es: "Abre la página del candidato",
    zh: "打开候选人页面",
  },
  Compare: { en: "Compare", es: "Comparar", zh: "比较" },
} satisfies Catalog;
