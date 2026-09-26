export type Airport = {
  code: string
  city: string
  name: string
  region: string
}

export const airports: Airport[] = [
  { code: 'DEL', city: 'Delhi', name: 'Indira Gandhi International Airport', region: 'Delhi NCR' },
  { code: 'BOM', city: 'Mumbai', name: 'Chhatrapati Shivaji Maharaj International Airport', region: 'Maharashtra' },
  { code: 'BLR', city: 'Bengaluru', name: 'Kempegowda International Airport', region: 'Karnataka' },
  { code: 'HYD', city: 'Hyderabad', name: 'Rajiv Gandhi International Airport', region: 'Telangana' },
  { code: 'MAA', city: 'Chennai', name: 'Chennai International Airport', region: 'Tamil Nadu' },
  { code: 'CCU', city: 'Kolkata', name: 'Netaji Subhas Chandra Bose International Airport', region: 'West Bengal' },
  { code: 'COK', city: 'Kochi', name: 'Cochin International Airport', region: 'Kerala' },
  { code: 'AMD', city: 'Ahmedabad', name: 'Sardar Vallabhbhai Patel International Airport', region: 'Gujarat' },
  { code: 'ATQ', city: 'Amritsar', name: 'Sri Guru Ram Dass Jee International Airport', region: 'Punjab' },
  { code: 'DED', city: 'Dehradun', name: 'Jolly Grant Airport', region: 'Uttarakhand' },
  { code: 'GOI', city: 'Goa', name: 'Dabolim Airport', region: 'Goa' },
  { code: 'GOX', city: 'Goa', name: 'Manohar International Airport', region: 'Goa' },
  { code: 'GAU', city: 'Guwahati', name: 'Lokpriya Gopinath Bordoloi International Airport', region: 'Assam' },
  { code: 'IXA', city: 'Agartala', name: 'Maharaja Bir Bikram Airport', region: 'Tripura' },
  { code: 'IXB', city: 'Siliguri', name: 'Bagdogra International Airport', region: 'West Bengal' },
  { code: 'IXC', city: 'Chandigarh', name: 'Shaheed Bhagat Singh International Airport', region: 'Chandigarh' },
  { code: 'IXD', city: 'Prayagraj', name: 'Prayagraj Airport', region: 'Uttar Pradesh' },
  { code: 'IXE', city: 'Mangaluru', name: 'Mangaluru International Airport', region: 'Karnataka' },
  { code: 'IXG', city: 'Belagavi', name: 'Belagavi Airport', region: 'Karnataka' },
  { code: 'IXH', city: 'Kailashahar', name: 'Kailashahar Airport', region: 'Tripura' },
  { code: 'IXI', city: 'North Lakhimpur', name: 'Lilabari Airport', region: 'Assam' },
  { code: 'IXJ', city: 'Jammu', name: 'Jammu Airport', region: 'Jammu and Kashmir' },
  { code: 'IXK', city: 'Junagadh', name: 'Keshod Airport', region: 'Gujarat' },
  { code: 'IXL', city: 'Leh', name: 'Kushok Bakula Rimpochee Airport', region: 'Ladakh' },
  { code: 'IXM', city: 'Madurai', name: 'Madurai International Airport', region: 'Tamil Nadu' },
  { code: 'IXN', city: 'Khowai', name: 'Khowai Airport', region: 'Tripura' },
  { code: 'IXP', city: 'Pathankot', name: 'Pathankot Airport', region: 'Punjab' },
  { code: 'IXR', city: 'Ranchi', name: 'Birsa Munda Airport', region: 'Jharkhand' },
  { code: 'IXS', city: 'Silchar', name: 'Silchar Airport', region: 'Assam' },
  { code: 'IXT', city: 'Pasighat', name: 'Pasighat Airport', region: 'Arunachal Pradesh' },
  { code: 'IXU', city: 'Aurangabad', name: 'Aurangabad Airport', region: 'Maharashtra' },
  { code: 'IXY', city: 'Kandla', name: 'Kandla Airport', region: 'Gujarat' },
  { code: 'IXZ', city: 'Port Blair', name: 'Veer Savarkar International Airport', region: 'Andaman and Nicobar Islands' },
  { code: 'JAI', city: 'Jaipur', name: 'Jaipur International Airport', region: 'Rajasthan' },
  { code: 'JDH', city: 'Jodhpur', name: 'Jodhpur Airport', region: 'Rajasthan' },
  { code: 'JGA', city: 'Jamnagar', name: 'Jamnagar Airport', region: 'Gujarat' },
  { code: 'JGB', city: 'Jagdalpur', name: 'Jagdalpur Airport', region: 'Chhattisgarh' },
  { code: 'JLR', city: 'Jabalpur', name: 'Jabalpur Airport', region: 'Madhya Pradesh' },
  { code: 'JRH', city: 'Jorhat', name: 'Jorhat Airport', region: 'Assam' },
  { code: 'JSA', city: 'Jaisalmer', name: 'Jaisalmer Airport', region: 'Rajasthan' },
  { code: 'KBP', city: 'Kushinagar', name: 'Kushinagar International Airport', region: 'Uttar Pradesh' },
  { code: 'KJB', city: 'Kurnool', name: 'Kurnool Airport', region: 'Andhra Pradesh' },
  { code: 'KLH', city: 'Kolhapur', name: 'Kolhapur Airport', region: 'Maharashtra' },
  { code: 'KNU', city: 'Kanpur', name: 'Kanpur Airport', region: 'Uttar Pradesh' },
  { code: 'KQH', city: 'Kishangarh', name: 'Kishangarh Airport', region: 'Rajasthan' },
  { code: 'KTU', city: 'Kota', name: 'Kota Airport', region: 'Rajasthan' },
  { code: 'KUU', city: 'Kullu-Manali', name: 'Kullu-Manali Airport', region: 'Himachal Pradesh' },
  { code: 'LKO', city: 'Lucknow', name: 'Chaudhary Charan Singh International Airport', region: 'Uttar Pradesh' },
  { code: 'LUH', city: 'Ludhiana', name: 'Ludhiana Airport', region: 'Punjab' },
  { code: 'MAA', city: 'Chennai', name: 'Chennai International Airport', region: 'Tamil Nadu' },
  { code: 'MDA', city: 'Mundra', name: 'Mundra Airport', region: 'Gujarat' },
  { code: 'NAG', city: 'Nagpur', name: 'Dr. Babasaheb Ambedkar International Airport', region: 'Maharashtra' },
  { code: 'NDC', city: 'Nanded', name: 'Shri Guru Gobind Singh Ji Airport', region: 'Maharashtra' },
  { code: 'NMI', city: 'Navi Mumbai', name: 'Navi Mumbai International Airport', region: 'Maharashtra' },
  { code: 'PNQ', city: 'Pune', name: 'Pune Airport', region: 'Maharashtra' },
  { code: 'PAT', city: 'Patna', name: 'Jay Prakash Narayan Airport', region: 'Bihar' },
  { code: 'PBD', city: 'Porbandar', name: 'Porbandar Airport', region: 'Gujarat' },
  { code: 'PGH', city: 'Pantnagar', name: 'Pantnagar Airport', region: 'Uttarakhand' },
  { code: 'RJA', city: 'Rajahmundry', name: 'Rajahmundry Airport', region: 'Andhra Pradesh' },
  { code: 'RPR', city: 'Raipur', name: 'Swami Vivekananda Airport', region: 'Chhattisgarh' },
  { code: 'STV', city: 'Surat', name: 'Surat International Airport', region: 'Gujarat' },
  { code: 'SXR', city: 'Srinagar', name: 'Srinagar International Airport', region: 'Jammu and Kashmir' },
  { code: 'TIR', city: 'Tirupati', name: 'Tirupati Airport', region: 'Andhra Pradesh' },
  { code: 'TRV', city: 'Thiruvananthapuram', name: 'Thiruvananthapuram International Airport', region: 'Kerala' },
  { code: 'TRZ', city: 'Tiruchirappalli', name: 'Tiruchirappalli International Airport', region: 'Tamil Nadu' },
  { code: 'UDR', city: 'Udaipur', name: 'Maharana Pratap Airport', region: 'Rajasthan' },
  { code: 'VGA', city: 'Vijayawada', name: 'Vijayawada Airport', region: 'Andhra Pradesh' },
  { code: 'VNS', city: 'Varanasi', name: 'Lal Bahadur Shastri Airport', region: 'Uttar Pradesh' },
  { code: 'VTZ', city: 'Visakhapatnam', name: 'Alluri Sitarama Raju International Airport', region: 'Andhra Pradesh' },
  { code: 'WGC', city: 'Warangal', name: 'Warangal Airport', region: 'Telangana' },
]

export function airportDisplayLabel(airport: Airport) {
  return `${airport.city} - ${airport.name} (${airport.code})`
}

export const airportOptions = airports.map((airport) => ({
  value: airportDisplayLabel(airport),
  label: airportDisplayLabel(airport),
}))

export function findAirport(input: string) {
  const normalized = input.trim().toUpperCase()
  if (!normalized) {
    return null
  }

  return airports.find((airport) => {
    const label = airportDisplayLabel(airport).toUpperCase()
    return (
      airport.code.toUpperCase() === normalized ||
      airport.city.toUpperCase() === normalized ||
      airport.region.toUpperCase() === normalized ||
      airport.name.toUpperCase() === normalized ||
      label === normalized ||
      label.includes(normalized) ||
      normalized.includes(airport.code.toUpperCase())
    )
  })
}
