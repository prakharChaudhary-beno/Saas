// utils/locationConstants.js
// Standardized location data for enterprise HRMS (Backend)

// ─── Indian States & UTs ─────────────────────────────────────
const INDIAN_STATES = [
  { value: 'AN', label: 'Andaman and Nicobar Islands', code: '35' },
  { value: 'AP', label: 'Andhra Pradesh', code: '28' },
  { value: 'AR', label: 'Arunachal Pradesh', code: '12' },
  { value: 'AS', label: 'Assam', code: '18' },
  { value: 'BR', label: 'Bihar', code: '10' },
  { value: 'CH', label: 'Chandigarh', code: '04' },
  { value: 'CT', label: 'Chhattisgarh', code: '22' },
  { value: 'DL', label: 'Delhi', code: '07' },
  { value: 'GA', label: 'Goa', code: '30' },
  { value: 'GJ', label: 'Gujarat', code: '24' },
  { value: 'HR', label: 'Haryana', code: '06' },
  { value: 'HP', label: 'Himachal Pradesh', code: '02' },
  { value: 'JK', label: 'Jammu and Kashmir', code: '01' },
  { value: 'JH', label: 'Jharkhand', code: '20' },
  { value: 'KA', label: 'Karnataka', code: '29' },
  { value: 'KL', label: 'Kerala', code: '32' },
  { value: 'LA', label: 'Ladakh', code: '37' },
  { value: 'LD', label: 'Lakshadweep', code: '31' },
  { value: 'MP', label: 'Madhya Pradesh', code: '23' },
  { value: 'MH', label: 'Maharashtra', code: '27' },
  { value: 'MN', label: 'Manipur', code: '14' },
  { value: 'ML', label: 'Meghalaya', code: '17' },
  { value: 'MZ', label: 'Mizoram', code: '15' },
  { value: 'NL', label: 'Nagaland', code: '13' },
  { value: 'OR', label: 'Odisha', code: '21' },
  { value: 'PY', label: 'Puducherry', code: '34' },
  { value: 'PB', label: 'Punjab', code: '03' },
  { value: 'RJ', label: 'Rajasthan', code: '08' },
  { value: 'SK', label: 'Sikkim', code: '11' },
  { value: 'TN', label: 'Tamil Nadu', code: '33' },
  { value: 'TG', label: 'Telangana', code: '36' },
  { value: 'TR', label: 'Tripura', code: '16' },
  { value: 'UP', label: 'Uttar Pradesh', code: '09' },
  { value: 'UT', label: 'Uttarakhand', code: '05' },
  { value: 'WB', label: 'West Bengal', code: '19' }
]

// ─── Major Cities by State ────────────────────────────────────
const CITIES_BY_STATE = {
  'AN': ['Port Blair'],
  'AP': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati', 'Kakinada', 'Rajahmundry'],
  'AR': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang'],
  'AS': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur'],
  'BR': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Bihar Sharif'],
  'CH': ['Chandigarh'],
  'CT': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon'],
  'DL': ['New Delhi', 'Delhi', 'Central Delhi', 'South Delhi', 'North Delhi', 'East Delhi', 'West Delhi'],
  'GA': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
  'GJ': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Junagadh', 'Gandhidham'],
  'HR': ['Gurugram', 'Faridabad', 'Panipat', 'Karnal', 'Rohtak', 'Hisar', 'Sonipat', 'Ambala'],
  'HP': ['Shimla', 'Manali', 'Dharamshala', 'Solan', 'Mandi', 'Kullu', 'Kangra', 'Una'],
  'JK': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur', 'Katra'],
  'JH': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh', 'Deoghar', 'Dumka'],
  'KA': ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubli', 'Belgaum', 'Gulbarga', 'Shimoga', 'Davangere', 'Bellary'],
  'KL': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Alappuzha', 'Palakkad'],
  'LA': ['Leh', 'Kargil'],
  'LD': ['Kavaratti'],
  'MP': ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Rewa', 'Satna', 'Raipur'],
  'MH': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Thane', 'Kolhapur', 'Navi Mumbai'],
  'MN': ['Imphal'],
  'ML': ['Shillong', 'Tura', 'Jowai', 'Nongpoh'],
  'MZ': ['Aizawl', 'Lunglei', 'Champhai', 'Serchhip'],
  'NL': ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang'],
  'OR': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore'],
  'PY': ['Puducherry', 'Karaikal', 'Mahe', 'Yanam'],
  'PB': ['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Firozpur'],
  'RJ': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Alwar', 'Bharatpur', 'Sikar'],
  'SK': ['Gangtok', 'Namchi', 'Pelling', 'Geyzing'],
  'TN': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Vellore', 'Thoothukudi', 'Erode'],
  'TG': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Secunderabad'],
  'TR': ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailasahar'],
  'UP': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Allahabad', 'Noida', 'Ghaziabad', 'Meerut', 'Aligarh', 'Gorakhpur', 'Bareilly', 'Mathura', 'Moradabad'],
  'UT': ['Dehradun', 'Haridwar', 'Rishikesh', 'Nainital', 'Mussoorie', 'Roorkee', 'Rudrapur'],
  'WB': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Asansol', 'Darjeeling', 'Kharagpur', 'Haldia']
}

// ─── Geolocation Helper ──────────────────────────────────────
/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

/**
 * Validate if employee is within allowed radius
 * @param {Object} employeeLocation - { latitude, longitude }
 * @param {Object} unitLocation - { latitude, longitude, radiusMeters }
 * @returns {Object} - { isValid: boolean, distance: number, message: string }
 */
const validateGeoRadius = (employeeLocation, unitLocation) => {
  if (!employeeLocation?.latitude || !employeeLocation?.longitude) {
    return {
      isValid: false,
      distance: null,
      message: 'Employee location not provided'
    }
  }

  if (!unitLocation?.latitude || !unitLocation?.longitude) {
    return {
      isValid: true, // Allow if unit location not configured
      distance: 0,
      message: 'Unit location not configured - geo validation skipped'
    }
  }

  const distance = calculateDistance(
    employeeLocation.latitude,
    employeeLocation.longitude,
    unitLocation.latitude,
    unitLocation.longitude
  )

  const allowedRadius = unitLocation.radiusMeters || 200 // Default 200m

  return {
    isValid: distance <= allowedRadius,
    distance: Math.round(distance),
    allowedRadius,
    message: distance <= allowedRadius
      ? `Within allowed radius (${Math.round(distance)}m)`
      : `Outside allowed radius (${Math.round(distance)}m > ${allowedRadius}m)`
  }
}

module.exports = {
  INDIAN_STATES,
  CITIES_BY_STATE,
  calculateDistance,
  validateGeoRadius,
  getStateName: (stateCode) => INDIAN_STATES.find(s => s.value === stateCode)?.label || stateCode,
  getStateCode: (stateName) => INDIAN_STATES.find(s => s.label.toLowerCase() === stateName?.toLowerCase())?.value || null,
  getCitiesForState: (stateCode) => CITIES_BY_STATE[stateCode] || []
}
