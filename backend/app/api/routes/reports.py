from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.core.security import get_current_admin
from app.services.report_service import ReportGenerator
from loguru import logger

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("/generate")
async def generate_system_report(current_admin: dict = Depends(get_current_admin)):
    """Generate a comprehensive PDF intelligence report."""
    try:
        generator = ReportGenerator(current_admin)
        pdf_buffer = await generator.generate_pdf()
        
        # Format filename
        admin_role = current_admin.get("role", "admin")
        date_str = generator.admin_district.replace(" ", "_")
        filename = f"SafeHer_Intelligence_Report_{admin_role}.pdf"
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error(f"Error generating PDF report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")
