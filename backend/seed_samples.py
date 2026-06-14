import os
import uuid
import shutil
import asyncio
from sqlalchemy.orm import Session

from models.database import SessionLocal, User, Document, create_tables
from auth.auth_handler import get_password_hash
from services.document_service import process_document
from utils.config import get_settings
from utils.file_utils import get_file_extension

settings = get_settings()

async def seed_samples_for_user(db: Session, user: User) -> int:
    """
    Copy and process all files from sample_documents directory to the user's account.
    Returns the count of successfully seeded documents.
    """
    # Get project root and sample_documents folder
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    samples_dir = os.path.join(project_root, "sample_documents")
    
    if not os.path.exists(samples_dir):
        print(f"Sample documents folder not found at: {samples_dir}")
        return 0
        
    sample_files = [f for f in os.listdir(samples_dir) if os.path.isfile(os.path.join(samples_dir, f))]
    
    seeded_count = 0
    for filename in sample_files:
        # Check if already exists for this user
        existing = db.query(Document).filter(
            Document.user_id == user.id,
            Document.original_filename == filename
        ).first()
        if existing:
            print(f"Document '{filename}' already exists for user {user.email}. Skipping.")
            continue
            
        src_path = os.path.join(samples_dir, filename)
        ext = get_file_extension(filename)
        
        # Copy to user directory
        user_dir = os.path.join(settings.UPLOAD_DIR, "documents", str(user.id))
        os.makedirs(user_dir, exist_ok=True)
        unique_name = f"{uuid.uuid4().hex}.{ext}"
        dest_path = os.path.join(user_dir, unique_name)
        shutil.copy(src_path, dest_path)
        file_size = os.path.getsize(dest_path)
        
        # Create Document record
        doc = Document(
            user_id=user.id,
            filename=unique_name,
            original_filename=filename,
            file_path=dest_path,
            file_type=ext,
            file_size=file_size,
            status="uploaded"
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        
        print(f"Imported '{filename}' as doc ID {doc.id}. Starting processing...")
        
        # Run processing pipeline
        try:
            await process_document(
                document_id=doc.id,
                file_path=dest_path,
                filename=filename,
                db=db
            )
            print(f"Finished processing doc ID {doc.id} ('{filename}')")
            seeded_count += 1
        except Exception as e:
            print(f"Error processing doc ID {doc.id}: {e}")
            
    return seeded_count

async def main():
    # Ensure tables exist
    create_tables()
    
    db = SessionLocal()
    try:
        # Check if demo user exists
        demo_email = "demo@docmind.ai"
        user = db.query(User).filter(User.email == demo_email).first()
        if not user:
            print(f"Creating demo user: {demo_email}")
            user = User(
                email=demo_email,
                name="Demo User",
                password_hash=get_password_hash("DemoUser123!"),
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
        await seed_samples_for_user(db, user)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
