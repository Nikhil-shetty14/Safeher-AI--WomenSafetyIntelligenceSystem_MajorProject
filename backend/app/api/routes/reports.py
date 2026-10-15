from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.core.security import get_current_admin
from app.services.report_service import ReportGenerator
from loguru import logger

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("/generate")
async def generate_system_report(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    district: Optional[str] = Query(None, description="District filter"),
    division: Optional[str] = Query(None, description="Division filter"),
    current_admin: dict = Depends(get_current_admin)
):
    """Generate a comprehensive government-ready PDF intelligence report."""
    try:
        generator = ReportGenerator(
            admin=current_admin,
            start_date=start_date,
            end_date=end_date,
            requested_district=district,
            requested_division=division
        )
        pdf_buffer = await generator.generate_pdf()
        
        # Format filename
        admin_role = current_admin.get("role", "admin")
        jurisdiction_slug = (district or current_admin.get("district") or division or "Statewide").replace(" ", "_")
        date_stamp = datetime.utcnow().strftime("%Y%m%d_%H%M")
        filename = f"SafeHer_Official_Report_{jurisdiction_slug}_{date_stamp}.pdf"
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        logger.error(f"Error generating PDF report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")
