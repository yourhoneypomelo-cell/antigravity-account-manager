export interface CountryCodeItem {
  code: string;
  name: string;
  nameEn: string;
  dialCode: string;
  flag: string;
  priority?: number;
}

export const COUNTRIES: CountryCodeItem[] = [
  { code: "CN", name: "中国", nameEn: "China", dialCode: "+86", flag: "🇨🇳", priority: 1 },
  { code: "US", name: "美国", nameEn: "United States", dialCode: "+1", flag: "🇺🇸", priority: 2 },
  { code: "HK", name: "中国香港", nameEn: "Hong Kong", dialCode: "+852", flag: "🇭🇰", priority: 3 },
  { code: "TW", name: "中国台湾", nameEn: "Taiwan", dialCode: "+886", flag: "🇹🇼", priority: 4 },
  { code: "MO", name: "中国澳门", nameEn: "Macau", dialCode: "+853", flag: "🇲🇴", priority: 5 },
  { code: "JP", name: "日本", nameEn: "Japan", dialCode: "+81", flag: "🇯🇵", priority: 6 },
  { code: "GB", name: "英国", nameEn: "United Kingdom", dialCode: "+44", flag: "🇬🇧", priority: 7 },
  { code: "SG", name: "新加坡", nameEn: "Singapore", dialCode: "+65", flag: "🇸🇬", priority: 8 },
  { code: "KR", name: "韩国", nameEn: "South Korea", dialCode: "+82", flag: "🇰🇷", priority: 9 },
  { code: "CA", name: "加拿大", nameEn: "Canada", dialCode: "+1", flag: "🇨🇦", priority: 10 },
  { code: "AU", name: "澳大利亚", nameEn: "Australia", dialCode: "+61", flag: "🇦🇺", priority: 11 },
  { code: "DE", name: "德国", nameEn: "Germany", dialCode: "+49", flag: "🇩🇪", priority: 12 },
  { code: "FR", name: "法国", nameEn: "France", dialCode: "+33", flag: "🇫🇷", priority: 13 },
  { code: "RU", name: "俄罗斯", nameEn: "Russia", dialCode: "+7", flag: "🇷🇺", priority: 14 },
  { code: "MY", name: "马来西亚", nameEn: "Malaysia", dialCode: "+60", flag: "🇲🇾", priority: 15 },
  { code: "TH", name: "泰国", nameEn: "Thailand", dialCode: "+66", flag: "🇹🇭", priority: 16 },
  { code: "VN", name: "越南", nameEn: "Vietnam", dialCode: "+84", flag: "🇻🇳", priority: 17 },
  { code: "PH", name: "菲律宾", nameEn: "Philippines", dialCode: "+63", flag: "🇵🇭", priority: 18 },
  { code: "ID", name: "印度尼西亚", nameEn: "Indonesia", dialCode: "+62", flag: "🇮🇩", priority: 19 },
  { code: "IN", name: "印度", nameEn: "India", dialCode: "+91", flag: "🇮🇳", priority: 20 },
  { code: "NZ", name: "新西兰", nameEn: "New Zealand", dialCode: "+64", flag: "🇳🇿", priority: 21 },
  { code: "AE", name: "阿联酋", nameEn: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪", priority: 22 },
  { code: "SA", name: "沙特阿拉伯", nameEn: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦", priority: 23 },
  { code: "BR", name: "巴西", nameEn: "Brazil", dialCode: "+55", flag: "🇧🇷", priority: 24 },
  { code: "MX", name: "墨西哥", nameEn: "Mexico", dialCode: "+52", flag: "🇲🇽", priority: 25 },
  { code: "IT", name: "意大利", nameEn: "Italy", dialCode: "+39", flag: "🇮🇹", priority: 26 },
  { code: "ES", name: "西班牙", nameEn: "Spain", dialCode: "+34", flag: "🇪🇸", priority: 27 },
  { code: "NL", name: "荷兰", nameEn: "Netherlands", dialCode: "+31", flag: "🇳🇱", priority: 28 },
  { code: "CH", name: "瑞士", nameEn: "Switzerland", dialCode: "+41", flag: "🇨🇭", priority: 29 },
  { code: "SE", name: "瑞典", nameEn: "Sweden", dialCode: "+46", flag: "🇸🇪", priority: 30 },
  { code: "NO", name: "挪威", nameEn: "Norway", dialCode: "+47", flag: "🇳🇴", priority: 31 },
  { code: "DK", name: "丹麦", nameEn: "Denmark", dialCode: "+45", flag: "🇩🇰", priority: 32 },
  { code: "FI", name: "芬兰", nameEn: "Finland", dialCode: "+358", flag: "🇫🇮", priority: 33 },
  { code: "IE", name: "爱尔兰", nameEn: "Ireland", dialCode: "+353", flag: "🇮🇪", priority: 34 },
  { code: "PT", name: "葡萄牙", nameEn: "Portugal", dialCode: "+351", flag: "🇵🇹", priority: 35 },
  { code: "PL", name: "波兰", nameEn: "Poland", dialCode: "+48", flag: "🇵🇱", priority: 36 },
  { code: "UA", name: "乌克兰", nameEn: "Ukraine", dialCode: "+380", flag: "🇺🇦", priority: 37 },
  { code: "TR", name: "土耳其", nameEn: "Turkey", dialCode: "+90", flag: "🇹🇷", priority: 38 },
  { code: "IL", name: "以色列", nameEn: "Israel", dialCode: "+972", flag: "🇮🇱", priority: 39 },
  { code: "ZA", name: "南非", nameEn: "South Africa", dialCode: "+27", flag: "🇿🇦", priority: 40 },
  { code: "EG", name: "埃及", nameEn: "Egypt", dialCode: "+20", flag: "🇪🇬", priority: 41 },
  { code: "NG", name: "尼日利亚", nameEn: "Nigeria", dialCode: "+234", flag: "🇳🇬", priority: 42 },
  { code: "AR", name: "阿根廷", nameEn: "Argentina", dialCode: "+54", flag: "🇦🇷", priority: 43 },
  { code: "CL", name: "智利", nameEn: "Chile", dialCode: "+56", flag: "🇨🇱", priority: 44 },
  { code: "CO", name: "哥伦比亚", nameEn: "Colombia", dialCode: "+57", flag: "🇨🇴", priority: 45 },
  { code: "KZ", name: "哈萨克斯坦", nameEn: "Kazakhstan", dialCode: "+7", flag: "🇰🇿", priority: 46 },
  { code: "PK", name: "巴基斯坦", nameEn: "Pakistan", dialCode: "+92", flag: "🇵🇰", priority: 47 },
  { code: "BD", name: "孟加拉国", nameEn: "Bangladesh", dialCode: "+880", flag: "🇧🇩", priority: 48 },
  { code: "AF", name: "阿富汗", nameEn: "Afghanistan", dialCode: "+93", flag: "🇦🇫" },
  { code: "AL", name: "阿尔巴尼亚", nameEn: "Albania", dialCode: "+355", flag: "🇦🇱" },
  { code: "DZ", name: "阿尔及利亚", nameEn: "Algeria", dialCode: "+213", flag: "🇩🇿" },
  { code: "AD", name: "安道尔", nameEn: "Andorra", dialCode: "+376", flag: "🇦🇩" },
  { code: "AO", name: "安哥拉", nameEn: "Angola", dialCode: "+244", flag: "🇦🇴" },
  { code: "AI", name: "安圭拉", nameEn: "Anguilla", dialCode: "+1264", flag: "🇦🇮" },
  { code: "AG", name: "安提瓜和巴布达", nameEn: "Antigua and Barbuda", dialCode: "+1268", flag: "🇦🇬" },
  { code: "AM", name: "亚美尼亚", nameEn: "Armenia", dialCode: "+374", flag: "🇦🇲" },
  { code: "AW", name: "阿鲁巴", nameEn: "Aruba", dialCode: "+297", flag: "🇦🇼" },
  { code: "AT", name: "奥地利", nameEn: "Austria", dialCode: "+43", flag: "🇦🇹" },
  { code: "AZ", name: "阿塞拜疆", nameEn: "Azerbaijan", dialCode: "+994", flag: "🇦🇿" },
  { code: "BS", name: "巴哈马", nameEn: "Bahamas", dialCode: "+1242", flag: "🇧🇸" },
  { code: "BH", name: "巴林", nameEn: "Bahrain", dialCode: "+973", flag: "🇧🇭" },
  { code: "BB", name: "巴巴多斯", nameEn: "Barbados", dialCode: "+1246", flag: "🇧🇧" },
  { code: "BY", name: "白俄罗斯", nameEn: "Belarus", dialCode: "+375", flag: "🇧🇾" },
  { code: "BE", name: "比利时", nameEn: "Belgium", dialCode: "+32", flag: "🇧🇪" },
  { code: "BZ", name: "伯利兹", nameEn: "Belize", dialCode: "+501", flag: "🇧🇿" },
  { code: "BJ", name: "贝宁", nameEn: "Benin", dialCode: "+229", flag: "🇧🇯" },
  { code: "BM", name: "百慕大", nameEn: "Bermuda", dialCode: "+1441", flag: "🇧🇲" },
  { code: "BT", name: "不丹", nameEn: "Bhutan", dialCode: "+975", flag: "🇧🇹" },
  { code: "BO", name: "玻利维亚", nameEn: "Bolivia", dialCode: "+591", flag: "🇧🇴" },
  { code: "BA", name: "波斯尼亚和黑塞哥维那", nameEn: "Bosnia and Herzegovina", dialCode: "+387", flag: "🇧🇦" },
  { code: "BW", name: "博茨瓦纳", nameEn: "Botswana", dialCode: "+267", flag: "🇧🇼" },
  { code: "BN", name: "文莱", nameEn: "Brunei", dialCode: "+673", flag: "🇧🇳" },
  { code: "BG", name: "保加利亚", nameEn: "Bulgaria", dialCode: "+359", flag: "🇧🇬" },
  { code: "BF", name: "布基纳法索", nameEn: "Burkina Faso", dialCode: "+226", flag: "🇧🇫" },
  { code: "BI", name: "布隆迪", nameEn: "Burundi", dialCode: "+257", flag: "🇧🇮" },
  { code: "KH", name: "柬埔寨", nameEn: "Cambodia", dialCode: "+855", flag: "🇰🇭" },
  { code: "CM", name: "喀麦隆", nameEn: "Cameroon", dialCode: "+237", flag: "🇨🇲" },
  { code: "CV", name: "佛得角", nameEn: "Cape Verde", dialCode: "+238", flag: "🇨🇻" },
  { code: "KY", name: "开曼群岛", nameEn: "Cayman Islands", dialCode: "+1345", flag: "🇰🇾" },
  { code: "CF", name: "中非共和国", nameEn: "Central African Republic", dialCode: "+236", flag: "🇨🇫" },
  { code: "TD", name: "乍得", nameEn: "Chad", dialCode: "+235", flag: "🇹🇩" },
  { code: "KM", name: "科摩罗", nameEn: "Comoros", dialCode: "+269", flag: "🇰🇲" },
  { code: "CG", name: "刚果（布）", nameEn: "Congo", dialCode: "+242", flag: "🇨🇬" },
  { code: "CD", name: "刚果（金）", nameEn: "DR Congo", dialCode: "+243", flag: "🇨🇩" },
  { code: "CR", name: "哥斯达黎加", nameEn: "Costa Rica", dialCode: "+506", flag: "🇨🇷" },
  { code: "CI", name: "科特迪瓦", nameEn: "Ivory Coast", dialCode: "+225", flag: "🇨🇮" },
  { code: "HR", name: "克罗地亚", nameEn: "Croatia", dialCode: "+385", flag: "🇭🇷" },
  { code: "CU", name: "古巴", nameEn: "Cuba", dialCode: "+53", flag: "🇨🇺" },
  { code: "CY", name: "塞浦路斯", nameEn: "Cyprus", dialCode: "+357", flag: "🇨🇾" },
  { code: "CZ", name: "捷克", nameEn: "Czech Republic", dialCode: "+420", flag: "🇨🇿" },
  { code: "DJ", name: "吉布提", nameEn: "Djibouti", dialCode: "+253", flag: "🇩🇯" },
  { code: "DM", name: "多米尼克", nameEn: "Dominica", dialCode: "+1767", flag: "🇩🇲" },
  { code: "DO", name: "多米尼加共和国", nameEn: "Dominican Republic", dialCode: "+1809", flag: "🇩🇴" },
  { code: "EC", name: "厄瓜多尔", nameEn: "Ecuador", dialCode: "+593", flag: "🇪🇨" },
  { code: "SV", name: "萨尔瓦多", nameEn: "El Salvador", dialCode: "+503", flag: "🇸🇻" },
  { code: "GQ", name: "赤道几内亚", nameEn: "Equatorial Guinea", dialCode: "+240", flag: "🇬🇶" },
  { code: "ER", name: "厄立特里亚", nameEn: "Eritrea", dialCode: "+291", flag: "🇪🇷" },
  { code: "EE", name: "爱沙尼亚", nameEn: "Estonia", dialCode: "+372", flag: "🇪🇪" },
  { code: "ET", name: "埃塞俄比亚", nameEn: "Ethiopia", dialCode: "+251", flag: "🇪🇹" },
  { code: "FJ", name: "斐济", nameEn: "Fiji", dialCode: "+679", flag: "🇫🇯" },
  { code: "GA", name: "加蓬", nameEn: "Gabon", dialCode: "+241", flag: "🇬🇦" },
  { code: "GM", name: "冈比亚", nameEn: "Gambia", dialCode: "+220", flag: "🇬🇲" },
  { code: "GE", name: "格鲁吉亚", nameEn: "Georgia", dialCode: "+995", flag: "🇬🇪" },
  { code: "GH", name: "加纳", nameEn: "Ghana", dialCode: "+233", flag: "🇬🇭" },
  { code: "GI", name: "直布罗陀", nameEn: "Gibraltar", dialCode: "+350", flag: "🇬🇮" },
  { code: "GR", name: "希腊", nameEn: "Greece", dialCode: "+30", flag: "🇬🇷" },
  { code: "GL", name: "格陵兰", nameEn: "Greenland", dialCode: "+299", flag: "🇬🇱" },
  { code: "GD", name: "格林纳达", nameEn: "Grenada", dialCode: "+1473", flag: "🇬🇩" },
  { code: "GP", name: "瓜德罗普", nameEn: "Guadeloupe", dialCode: "+590", flag: "🇬🇵" },
  { code: "GU", name: "关岛", nameEn: "Guam", dialCode: "+1671", flag: "🇬🇺" },
  { code: "GT", name: "危地马拉", nameEn: "Guatemala", dialCode: "+502", flag: "🇬🇹" },
  { code: "GN", name: "几内亚", nameEn: "Guinea", dialCode: "+224", flag: "🇬🇳" },
  { code: "GW", name: "几内亚比绍", nameEn: "Guinea-Bissau", dialCode: "+245", flag: "🇬🇼" },
  { code: "GY", name: "圭亚那", nameEn: "Guyana", dialCode: "+592", flag: "🇬🇾" },
  { code: "HT", name: "海地", nameEn: "Haiti", dialCode: "+509", flag: "🇭🇹" },
  { code: "HN", name: "洪都拉斯", nameEn: "Honduras", dialCode: "+504", flag: "🇭🇳" },
  { code: "HU", name: "匈牙利", nameEn: "Hungary", dialCode: "+36", flag: "🇭🇺" },
  { code: "IS", name: "冰岛", nameEn: "Iceland", dialCode: "+354", flag: "🇮🇸" },
  { code: "IR", name: "伊朗", nameEn: "Iran", dialCode: "+98", flag: "🇮🇷" },
  { code: "IQ", name: "伊拉克", nameEn: "Iraq", dialCode: "+964", flag: "🇮🇶" },
  { code: "JM", name: "牙买加", nameEn: "Jamaica", dialCode: "+1876", flag: "🇯🇲" },
  { code: "JO", name: "约旦", nameEn: "Jordan", dialCode: "+962", flag: "🇯🇴" },
  { code: "KE", name: "肯尼亚", nameEn: "Kenya", dialCode: "+254", flag: "🇰🇪" },
  { code: "KW", name: "科威特", nameEn: "Kuwait", dialCode: "+965", flag: "🇰🇼" },
  { code: "KG", name: "吉尔吉斯斯坦", nameEn: "Kyrgyzstan", dialCode: "+996", flag: "🇰🇬" },
  { code: "LA", name: "老挝", nameEn: "Laos", dialCode: "+856", flag: "🇱🇦" },
  { code: "LV", name: "拉脱维亚", nameEn: "Latvia", dialCode: "+371", flag: "🇱🇻" },
  { code: "LB", name: "黎巴嫩", nameEn: "Lebanon", dialCode: "+961", flag: "🇱🇧" },
  { code: "LS", name: "莱索托", nameEn: "Lesotho", dialCode: "+266", flag: "🇱🇸" },
  { code: "LR", name: "利比里亚", nameEn: "Liberia", dialCode: "+231", flag: "🇱🇷" },
  { code: "LY", name: "利比亚", nameEn: "Libya", dialCode: "+218", flag: "🇱🇾" },
  { code: "LI", name: "列支敦士登", nameEn: "Liechtenstein", dialCode: "+423", flag: "🇱🇮" },
  { code: "LT", name: "立陶宛", nameEn: "Lithuania", dialCode: "+370", flag: "🇱🇹" },
  { code: "LU", name: "卢森堡", nameEn: "Luxembourg", dialCode: "+352", flag: "🇱🇺" },
  { code: "MK", name: "北马其顿", nameEn: "North Macedonia", dialCode: "+389", flag: "🇲🇰" },
  { code: "MG", name: "马达加斯加", nameEn: "Madagascar", dialCode: "+261", flag: "🇲🇬" },
  { code: "MW", name: "马拉维", nameEn: "Malawi", dialCode: "+265", flag: "🇲🇼" },
  { code: "MV", name: "马尔代夫", nameEn: "Maldives", dialCode: "+960", flag: "🇲🇻" },
  { code: "ML", name: "马里", nameEn: "Mali", dialCode: "+223", flag: "🇲🇱" },
  { code: "MT", name: "马耳他", nameEn: "Malta", dialCode: "+356", flag: "🇲🇹" },
  { code: "MR", name: "毛里塔尼亚", nameEn: "Mauritania", dialCode: "+222", flag: "🇲🇷" },
  { code: "MU", name: "毛里求斯", nameEn: "Mauritius", dialCode: "+230", flag: "🇲🇺" },
  { code: "MD", name: "摩尔多瓦", nameEn: "Moldova", dialCode: "+373", flag: "🇲🇩" },
  { code: "MC", name: "摩纳哥", nameEn: "Monaco", dialCode: "+377", flag: "🇲🇨" },
  { code: "MN", name: "蒙古", nameEn: "Mongolia", dialCode: "+976", flag: "🇲🇳" },
  { code: "ME", name: "黑山", nameEn: "Montenegro", dialCode: "+382", flag: "🇲🇪" },
  { code: "MA", name: "摩洛哥", nameEn: "Morocco", dialCode: "+212", flag: "🇲🇦" },
  { code: "MZ", name: "莫桑比克", nameEn: "Mozambique", dialCode: "+258", flag: "🇲🇿" },
  { code: "MM", name: "缅甸", nameEn: "Myanmar", dialCode: "+95", flag: "🇲🇲" },
  { code: "NA", name: "纳米比亚", nameEn: "Namibia", dialCode: "+264", flag: "🇳🇦" },
  { code: "NP", name: "尼泊尔", nameEn: "Nepal", dialCode: "+977", flag: "🇳🇵" },
  { code: "NI", name: "尼加拉瓜", nameEn: "Nicaragua", dialCode: "+505", flag: "🇳🇮" },
  { code: "NE", name: "尼日尔", nameEn: "Niger", dialCode: "+227", flag: "🇳🇪" },
  { code: "OM", name: "阿曼", nameEn: "Oman", dialCode: "+968", flag: "🇴🇲" },
  { code: "PA", name: "巴拿马", nameEn: "Panama", dialCode: "+507", flag: "🇵🇦" },
  { code: "PG", name: "巴布亚新几内亚", nameEn: "Papua New Guinea", dialCode: "+675", flag: "🇵🇬" },
  { code: "PY", name: "巴拉圭", nameEn: "Paraguay", dialCode: "+595", flag: "🇵🇾" },
  { code: "PE", name: "秘鲁", nameEn: "Peru", dialCode: "+51", flag: "🇵🇪" },
  { code: "PR", name: "波多黎各", nameEn: "Puerto Rico", dialCode: "+1787", flag: "🇵🇷" },
  { code: "QA", name: "卡塔尔", nameEn: "Qatar", dialCode: "+974", flag: "🇶🇦" },
  { code: "RO", name: "罗马尼亚", nameEn: "Romania", dialCode: "+40", flag: "🇷🇴" },
  { code: "RW", name: "卢旺达", nameEn: "Rwanda", dialCode: "+250", flag: "🇷🇼" },
  { code: "WS", name: "萨摩亚", nameEn: "Samoa", dialCode: "+685", flag: "🇼🇸" },
  { code: "SM", name: "圣马力诺", nameEn: "San Marino", dialCode: "+378", flag: "🇸🇲" },
  { code: "SN", name: "塞内加尔", nameEn: "Senegal", dialCode: "+221", flag: "🇸🇳" },
  { code: "RS", name: "塞尔维亚", nameEn: "Serbia", dialCode: "+381", flag: "🇷🇸" },
  { code: "SC", name: "塞舌尔", nameEn: "Seychelles", dialCode: "+248", flag: "🇸🇨" },
  { code: "SL", name: "塞拉利昂", nameEn: "Sierra Leone", dialCode: "+232", flag: "🇸🇱" },
  { code: "SK", name: "斯洛伐克", nameEn: "Slovakia", dialCode: "+421", flag: "🇸🇰" },
  { code: "SI", name: "斯洛文尼亚", nameEn: "Slovenia", dialCode: "+386", flag: "🇸🇮" },
  { code: "SO", name: "索马里", nameEn: "Somalia", dialCode: "+252", flag: "🇸🇴" },
  { code: "LK", name: "斯里兰卡", nameEn: "Sri Lanka", dialCode: "+94", flag: "🇱🇰" },
  { code: "SD", name: "苏丹", nameEn: "Sudan", dialCode: "+249", flag: "🇸🇩" },
  { code: "SR", name: "苏里南", nameEn: "Suriname", dialCode: "+597", flag: "🇸🇷" },
  { code: "SY", name: "叙利亚", nameEn: "Syria", dialCode: "+963", flag: "🇸🇾" },
  { code: "TJ", name: "塔吉克斯坦", nameEn: "Tajikistan", dialCode: "+992", flag: "🇹🇯" },
  { code: "TZ", name: "坦桑尼亚", nameEn: "Tanzania", dialCode: "+255", flag: "🇹🇿" },
  { code: "TG", name: "多哥", nameEn: "Togo", dialCode: "+228", flag: "🇹🇬" },
  { code: "TO", name: "汤加", nameEn: "Tonga", dialCode: "+676", flag: "🇹🇴" },
  { code: "TT", name: "特立尼达和多巴哥", nameEn: "Trinidad and Tobago", dialCode: "+1868", flag: "🇹🇹" },
  { code: "TN", name: "突尼斯", nameEn: "Tunisia", dialCode: "+216", flag: "🇹🇳" },
  { code: "TM", name: "土库曼斯坦", nameEn: "Turkmenistan", dialCode: "+993", flag: "🇹🇲" },
  { code: "UG", name: "乌干达", nameEn: "Uganda", dialCode: "+256", flag: "🇺🇬" },
  { code: "UY", name: "乌拉圭", nameEn: "Uruguay", dialCode: "+598", flag: "🇺🇾" },
  { code: "UZ", name: "乌兹别克斯坦", nameEn: "Uzbekistan", dialCode: "+998", flag: "🇺🇿" },
  { code: "VU", name: "瓦努阿图", nameEn: "Vanuatu", dialCode: "+678", flag: "🇻🇺" },
  { code: "VE", name: "委内瑞拉", nameEn: "Venezuela", dialCode: "+58", flag: "🇻🇪" },
  { code: "YE", name: "也门", nameEn: "Yemen", dialCode: "+967", flag: "🇾🇪" },
  { code: "ZM", name: "赞比亚", nameEn: "Zambia", dialCode: "+260", flag: "🇿🇲" },
  { code: "ZW", name: "津巴布韦", nameEn: "Zimbabwe", dialCode: "+263", flag: "🇿🇼" },
];

export const POPULAR_COUNTRIES: CountryCodeItem[] = COUNTRIES.filter(c => c.priority !== undefined).sort((a, b) => (a.priority || 999) - (b.priority || 999));


export function findCountryByDialCode(dialCode: string): CountryCodeItem | undefined {
  const normalized = dialCode.startsWith("+") ? dialCode : "+" + dialCode;
  const exact = COUNTRIES.filter(c => c.dialCode === normalized);
  if (!exact.length) return undefined;
  return exact.sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
}

export function findCountryByCode(code: string): CountryCodeItem | undefined {
  return COUNTRIES.find(c => c.code.toUpperCase() === code.toUpperCase());
}

export function filterCountries(query: string): CountryCodeItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;
  const qNoPlus = q.startsWith("+") ? q.slice(1) : q;
  return COUNTRIES.filter(c => {
    return (
      c.name.toLowerCase().includes(q) ||
      c.nameEn.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.dialCode.includes(q) ||
      c.dialCode.slice(1).includes(qNoPlus)
    );
  });
}

export function parsePhoneNumber(
  raw: string,
  fallbackDialCode: string = "+86"
): { dialCode: string; nationalNumber: string; country: CountryCodeItem } {
  const fallbackCountry = findCountryByDialCode(fallbackDialCode) || COUNTRIES[0];
  const s = raw.trim();
  if (!s) {
    return { dialCode: fallbackDialCode, nationalNumber: "", country: fallbackCountry };
  }

  // 1. If starts with 00 (international call prefix, e.g. 0086...)
  if (s.startsWith("00") && s.length > 4) {
    return parsePhoneNumber("+" + s.slice(2).trim(), fallbackDialCode);
  }

  // 2. If starts with "+"
  if (s.startsWith("+")) {
    const sNoPlus = s.slice(1).trim();
    // Try explicit separator: e.g. "+86 14792924955" or "+1-555-234-5678"
    const spaceMatch = sNoPlus.match(/^(\d{1,4})[\s\-\/.](.+)$/);
    if (spaceMatch) {
      const country = findCountryByDialCode("+" + spaceMatch[1]);
      if (country) {
        return {
          dialCode: country.dialCode,
          nationalNumber: spaceMatch[2].trim(),
          country,
        };
      }
    }

    // Try continuous digits matching longest dial code: 4, 3, 2, 1
    const digitsOnly = sNoPlus.replace(/\D/g, "");
    for (const len of [4, 3, 2, 1]) {
      if (digitsOnly.length > len) {
        const prefix = "+" + digitsOnly.slice(0, len);
        const country = findCountryByDialCode(prefix);
        if (country) {
          const prefixDigits = digitsOnly.slice(0, len);
          let matchIdx = 0;
          let cutIdx = 0;
          for (let i = 0; i < sNoPlus.length; i++) {
            if (sNoPlus[i] === prefixDigits[matchIdx]) {
              matchIdx++;
              if (matchIdx === prefixDigits.length) {
                cutIdx = i + 1;
                break;
              }
            }
          }
          const remaining = sNoPlus.slice(cutIdx).trim().replace(/^[\s\-.]+/, "");
          return {
            dialCode: country.dialCode,
            nationalNumber: remaining || digitsOnly.slice(len),
            country,
          };
        }
      }
    }
  }

  // 3. Delimited without '+': e.g. "86 14792924955", "86-14792924955", "(86) 14792924955"
  const delimMatch = s.match(/^[\(（]?(\d{1,4})[\)）]?[\s\-\/.]+(.+)$/);
  if (delimMatch) {
    const country = findCountryByDialCode("+" + delimMatch[1]);
    if (country) {
      return {
        dialCode: country.dialCode,
        nationalNumber: delimMatch[2].trim(),
        country,
      };
    }
  }

  // 4. Raw continuous digits without '+' or delimiters: e.g. "8614792924955", "85291234567"
  const allDigits = s.replace(/\D/g, "");

  // Special case: China domestic mobile (11 digits starting with 1) when fallback is +86
  if (allDigits.length === 11 && allDigits.startsWith("1") && fallbackDialCode === "+86") {
    return {
      dialCode: "+86",
      nationalNumber: s,
      country: fallbackCountry,
    };
  }

  // Special case: China international format without plus "8614792924955" (13 digits starting with 861)
  if (allDigits.length === 13 && allDigits.startsWith("861")) {
    const cn = findCountryByDialCode("+86") || fallbackCountry;
    return {
      dialCode: "+86",
      nationalNumber: allDigits.slice(2),
      country: cn,
    };
  }

  // Check 3-digit and 2-digit dial codes if remainder has reasonable phone length (>= 7 digits)
  for (const len of [3, 2]) {
    if (allDigits.length >= len + 7) {
      const prefix = "+" + allDigits.slice(0, len);
      const country = findCountryByDialCode(prefix);
      if (country) {
        return {
          dialCode: country.dialCode,
          nationalNumber: allDigits.slice(len),
          country,
        };
      }
    }
  }

  // Fallback: keep current dial code, full input as national number
  return {
    dialCode: fallbackDialCode,
    nationalNumber: s,
    country: fallbackCountry,
  };
}

export function formatFullPhone(dialCode: string, nationalNumber: string): string {
  const num = nationalNumber.trim();
  if (!num) return "";
  const code = dialCode.startsWith("+") ? dialCode : "+" + dialCode;
  return `${code} ${num}`;
}

export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/[\s\-()（）]/g, "");
}
