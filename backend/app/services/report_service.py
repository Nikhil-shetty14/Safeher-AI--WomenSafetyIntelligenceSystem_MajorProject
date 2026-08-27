import io
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import matplotlib
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

from app.core.database import get_collection

# Use non-interactive backend for matplotlib
matplotlib.use('Agg')

class ReportGenerator:
    def __init__(self, admin: dict):
        self.admin = admin
        self.admin_role = admin.get("role", "admin")
        self.admin_district = admin.get("district", "All")
        self.admin_division = admin.get("division", "All")
        
    def get_alert_filter(self) -> dict:
        if self.admin_role in ["super_admin", "admin"]:
            return {}
        elif self.admin_role == "regional_admin":
            return {"location.division": self.admin_division}
        elif self.admin_role == "district_admin":
            return {"location.district": self.admin_district}
        return {"_id": "unauthorized"}

    def get_user_filter(self) -> dict:
        if self.admin_role in ["super_admin", "admin"]:
            return {}
        elif self.admin_role == "regional_admin":
            return {"division": self.admin_division}
        elif self.admin_role == "district_admin":
            return {"district": self.admin_district}
        return {"_id": "unauthorized"}

    async def fetch_data(self):
        alerts_col = get_collection("alerts")
        users_col = get_collection("users")
        complaints_col = get_collection("complaints")
        predictions_col = get_collection("ai_predictions")

        alert_filter = self.get_alert_filter()
        user_filter = self.get_user_filter()

        # Stats
        total_users = await users_col.count_documents(user_filter) if users_col is not None else 0
        active_alerts = await alerts_col.count_documents({"status": "active", **alert_filter}) if alerts_col is not None else 0
        total_alerts = await alerts_col.count_documents(alert_filter) if alerts_col is not None else 0
        total_complaints = await complaints_col.count_documents(user_filter) if complaints_col is not None else 0
        
        # Recent Alerts
        recent_alerts = []
        if alerts_col is not None:
            cursor = alerts_col.find(alert_filter).sort("created_at", -1).limit(10)
            recent_alerts = await cursor.to_list(length=10)

        # Recent AI Predictions
        recent_predictions = []
        if predictions_col is not None:
            cursor = predictions_col.find({}).sort("created_at", -1).limit(5)
            recent_predictions = await cursor.to_list(length=5)
            
        # Incident Severity Distribution
        severity_dist = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        if alerts_col is not None:
            cursor = alerts_col.find(alert_filter, {"severity": 1})
            async for doc in cursor:
                sev = doc.get("severity", "medium").lower()
                if sev in severity_dist:
                    severity_dist[sev] += 1
                else:
                    severity_dist["medium"] += 1

        return {
            "stats": {
                "total_users": total_users,
                "active_alerts": active_alerts,
                "total_alerts": total_alerts,
                "total_complaints": total_complaints
            },
            "recent_alerts": recent_alerts,
            "recent_predictions": recent_predictions,
            "severity_dist": severity_dist
        }

    def generate_severity_chart(self, severity_dist):
        labels = list(severity_dist.keys())
        sizes = list(severity_dist.values())
        
        # Filter out 0s
        labels = [l for l, s in zip(labels, sizes) if s > 0]
        sizes = [s for s in sizes if s > 0]
        
        if not sizes:
            labels = ['No Data']
            sizes = [1]

        colors_map = {'critical': '#e74c3c', 'high': '#e67e22', 'medium': '#f1c40f', 'low': '#3498db'}
        pie_colors = [colors_map.get(l.lower(), '#95a5a6') for l in labels]

        fig, ax = plt.subplots(figsize=(5, 4))
        ax.pie(sizes, labels=[l.capitalize() for l in labels], colors=pie_colors, autopct='%1.1f%%', startangle=90)
        ax.axis('equal')
        plt.title('SOS Alert Severity Distribution')
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight')
        plt.close(fig)
        buf.seek(0)
        return buf

    async def generate_pdf(self) -> io.BytesIO:
        data = await self.fetch_data()
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        
        styles = getSampleStyleSheet()
        
        # Custom Styles
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#2c3e50'),
            alignment=1,
            spaceAfter=20
        )
        
        subtitle_style = ParagraphStyle(
            'SubtitleStyle',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#34495e'),
            spaceAfter=10,
            spaceBefore=15
        )
        
        normal_style = styles['Normal']
        
        elements = []
        
        # HEADER / BRANDING
        elements.append(Paragraph("<b>SafeHer AI</b>", title_style))
        elements.append(Paragraph("<b>Official Intelligence & Security Report</b>", subtitle_style))
        
        report_meta = f"""
        <b>Generated By:</b> {self.admin.get('name', 'Admin')} ({self.admin_role})<br/>
        <b>Region/District:</b> {self.admin_division} / {self.admin_district}<br/>
        <b>Date:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
        """
        elements.append(Paragraph(report_meta, normal_style))
        elements.append(Spacer(1, 20))
        
        # EXECUTIVE SUMMARY
        elements.append(Paragraph("Executive Summary", subtitle_style))
        stats = data['stats']
        summary_text = (
            f"This report covers system metrics and intelligence insights. "
            f"Currently, there are <b>{stats['total_users']}</b> registered users in the specified jurisdiction. "
            f"The system has tracked a total of <b>{stats['total_alerts']}</b> SOS alerts, with <b>{stats['active_alerts']}</b> currently active. "
            f"Additionally, <b>{stats['total_complaints']}</b> official complaints have been filed."
        )
        elements.append(Paragraph(summary_text, normal_style))
        elements.append(Spacer(1, 20))
        
        # CHARTS
        elements.append(Paragraph("Incident Severity Analytics", subtitle_style))
        chart_buf = self.generate_severity_chart(data['severity_dist'])
        chart_img = Image(chart_buf, width=4*inch, height=3.2*inch)
        elements.append(chart_img)
        elements.append(Spacer(1, 20))
        
        # TACTICAL INTELLIGENCE (Recent AI Predictions)
        elements.append(Paragraph("Tactical AI Intelligence", subtitle_style))
        if data['recent_predictions']:
            ai_data = [["Time", "Danger Level", "Confidence", "Location / Factors"]]
            for pred in data['recent_predictions']:
                time_str = pred.get('created_at', datetime.utcnow()).strftime('%Y-%m-%d %H:%M')
                level = pred.get('danger_level', 'Medium').upper()
                conf = f"{pred.get('confidence', 0)*100:.1f}%"
                factors = ", ".join(pred.get('factors', []))[:60] + "..."
                ai_data.append([time_str, level, conf, factors])
                
            ai_table = Table(ai_data, colWidths=[1.5*inch, 1*inch, 1*inch, 3.5*inch])
            ai_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2c3e50')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0,0), (-1,0), 12),
                ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f9f9f9')),
                ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#bdc3c7'))
            ]))
            elements.append(ai_table)
        else:
            elements.append(Paragraph("No recent AI tactical intelligence available.", normal_style))
        
        elements.append(PageBreak())
        
        # RECENT INCIDENTS (EVIDENCE SUMMARY)
        elements.append(Paragraph("Recent SOS Incidents & Evidence", subtitle_style))
        if data['recent_alerts']:
            alert_data = [["Time", "User ID", "Severity", "Location (Lat, Lng)"]]
            for alert in data['recent_alerts']:
                time_str = alert.get('created_at', datetime.utcnow()).strftime('%Y-%m-%d %H:%M')
                user_id = str(alert.get('user_id', 'Unknown'))[:10] + "..."
                sev = alert.get('severity', 'Medium').upper()
                loc = alert.get('location', {}) or {}
                lat = loc.get('latitude')
                lng = loc.get('longitude')
                if lat is not None and lng is not None:
                    loc_str = f"{lat:.4f}, {lng:.4f}"
                else:
                    loc_str = "Unknown"
                alert_data.append([time_str, user_id, sev, loc_str])
                
            alert_table = Table(alert_data, colWidths=[1.5*inch, 1.5*inch, 1*inch, 3*inch])
            alert_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e74c3c')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0,0), (-1,0), 12),
                ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f9f9f9')),
                ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#bdc3c7'))
            ]))
            elements.append(alert_table)
        else:
            elements.append(Paragraph("No recent SOS incidents.", normal_style))
            
        elements.append(Spacer(1, 20))
        
        # RECOMMENDATIONS
        elements.append(Paragraph("Official Recommendations & Actions", subtitle_style))
        rec_text = (
            "1. Deploy smart patrols to areas with recent critical incidents.<br/>"
            "2. Review and follow up on any unresolved official complaints.<br/>"
            "3. Broadcast safety advisories to users in identified AI threat hotspots.<br/>"
            "4. Monitor active alerts continuously until resolved."
        )
        elements.append(Paragraph(rec_text, normal_style))

        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer
