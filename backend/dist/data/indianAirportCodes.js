export const INDIAN_AIRPORT_CODES = new Set([
    'AMD', 'ATQ', 'BBI', 'BDQ', 'BHO', 'BLR', 'BOM', 'CCJ', 'CCU', 'CJB', 'COK', 'DED',
    'DEL', 'DIB', 'DIU', 'GAU', 'GOI', 'GOX', 'GWL', 'HYD', 'IDR', 'IMF', 'ISK', 'IXA',
    'IXB', 'IXC', 'IXD', 'IXE', 'IXG', 'IXH', 'IXI', 'IXJ', 'IXK', 'IXL', 'IXM', 'IXN',
    'IXP', 'IXR', 'IXS', 'IXT', 'IXU', 'IXY', 'IXZ', 'JAI', 'JDH', 'JGA', 'JGB', 'JLR',
    'JRH', 'JSA', 'KBP', 'KJB', 'KLH', 'KNU', 'KQH', 'KTU', 'KUU', 'LKO', 'LUH', 'MAA',
    'MDA', 'NAG', 'NDC', 'NMI', 'PNQ', 'PAT', 'PBD', 'PGH', 'RJA', 'RPR', 'STV', 'SXR',
    'TIR', 'TRV', 'TRZ', 'UDR', 'VGA', 'VNS', 'VTZ', 'WGC',
]);
export function isValidIndianAirportCode(code) {
    return INDIAN_AIRPORT_CODES.has(code.trim().toUpperCase());
}
