/**
 * Generates a 1-tap official carrier live tracking URL pre-filled with the user's AWB,
 * so even CAPTCHA-protected or regional couriers open in one tap with zero retyping.
 */
export function buildCarrierTrackingUrl(carrierCode: string, awb: string): string {
  const clean = encodeURIComponent(awb.replace(/\s+/g, '').toUpperCase());
  const code = carrierCode.toLowerCase();

  switch (code) {
    case 'japanpost':
      return `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${clean}&locale=en`;
    case 'dhl':
    case 'deutschepost':
      return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${clean}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${clean}`;
    case 'ups':
      return `https://www.ups.com/track?tracknum=${clean}`;
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${clean}`;
    case 'indiapost':
      return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
    case 'bluedart':
      return `https://www.bluedart.com/tracking?trackFor=0&trackNo=${clean}`;
    case 'delhivery':
      return `https://www.delhivery.com/track-v2/package/${clean}`;
    case 'dtdc':
      return `https://www.dtdc.in/tracking.asp`;
    case 'ekart':
      return `https://ekartlogistics.com/shipmenttrack/${clean}`;
    case 'xpressbees':
      return `https://www.xpressbees.com/shipment/tracking?awbNo=${clean}`;
    case 'aramex':
      return `https://www.aramex.com/track/results?ShipmentNumber=${clean}`;
    case 'royalmail':
      return `https://www.royalmail.com/track-your-item#/tracking-results/${clean}`;
    case 'cainiao':
    case 'chinapost':
    case 'yanwen':
    case 'yunexpress':
    case '4px':
      return `https://global.cainiao.com/newDetail.htm?mailNoList=${clean}`;
    case 'sfexpress':
      return `https://www.sf-express.com/chn/en/dynamic_function/waybill/#search/bill-number/${clean}`;
    case 'singpost':
      return `https://www.singpost.com/track-items`;
    case 'auspost':
      return `https://auspost.com.au/mypost/track/#/details/${clean}`;
    case 'canadapost':
      return `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${clean}`;
    case 'postnl':
      return `https://postnl.post/details/?barcodes=${clean}`;
    case 'dpd':
      return `https://tracking.dpd.de/status/en_US/parcel/${clean}`;
    case 'laposte':
      return `https://www.laposte.fr/outils/suivre-vos-envois?code=${clean}`;
    case 'koreapost':
      return `https://service.epost.go.kr/trace.RetrieveEmsRigiTraceList.comm?POST_CODE=${clean}&displayHeader=N`;
    default:
      return `https://t.17track.net/en#nums=${clean}`;
  }
}
